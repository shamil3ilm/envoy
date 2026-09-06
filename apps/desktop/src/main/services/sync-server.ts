import http from 'http';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { app, shell } from 'electron';
import QRCode from 'qrcode';
import type { IDatabase } from './database.interface';
import { collectBackup, restoreEnvelope } from './backup';
import { logger } from './logger';
import { logBackupEvent } from './backup-audit';

const DEFAULT_PORT = 47828;
const MAX_BODY_BYTES = 100 * 1024 * 1024; // 100 MB envelope cap

interface ServerOptions {
  enabled: boolean;
  port: number;
  token: string;
}

let server: http.Server | null = null;
let currentDb: IDatabase | null = null;
let currentToken = '';
let currentPort = DEFAULT_PORT;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
  });
  res.end(json);
}

function tokenIsValid(req: http.IncomingMessage): boolean {
  const header = req.headers['x-envoy-token'];
  if (typeof header !== 'string' || currentToken === '') return false;
  // Constant-time comparison to avoid timing side-channels on the token.
  const a = Buffer.from(header);
  const b = Buffer.from(currentToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on('data', (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');

  // Ping is unauthenticated — used by mobile to confirm reachability + version.
  if (url.pathname === '/envoy/v1/ping' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, appVersion: app.getVersion() });
    return;
  }

  if (!currentDb) {
    sendJson(res, 503, { error: 'Database not ready' });
    return;
  }

  if (!tokenIsValid(req)) {
    sendJson(res, 401, { error: 'Missing or invalid X-Envoy-Token' });
    return;
  }

  const peer = req.socket.remoteAddress ?? 'unknown';

  if (url.pathname === '/envoy/v1/envelope' && req.method === 'GET') {
    try {
      const envelope = await collectBackup(currentDb);
      sendJson(res, 200, envelope);
      const total = Object.values(envelope.counts).reduce((s, n) => s + n, 0);
      await logBackupEvent(currentDb, {
        action: 'backup_exported',
        description: `Sync pull sent ${total} records`,
        details: { mode: 'sync-pull', peer },
      });
    } catch (err) {
      logger.error('Sync pull failed', err);
      sendJson(res, 500, { error: 'Pull failed' });
    }
    return;
  }

  if (url.pathname === '/envoy/v1/envelope' && req.method === 'POST') {
    try {
      const envelope = await readJsonBody(req);
      const result = await restoreEnvelope(currentDb as never, envelope as never);
      sendJson(res, 200, result);
      await logBackupEvent(currentDb, {
        action: 'backup_restored',
        description: `Sync push applied ${result.totalApplied} records`,
        details: {
          mode: 'sync-push',
          peer,
          applied: result.applied,
          skipped: result.skipped,
        },
      });
    } catch (err) {
      logger.error('Sync push failed', err);
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Push failed' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

export function generateToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function getLanAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name] ?? [];
    for (const info of list) {
      if (info.family === 'IPv4' && !info.internal) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

export function startSyncServer(
  db: IDatabase,
  options: ServerOptions
): { url: string[]; port: number } | null {
  stopSyncServer();
  if (!options.enabled) {
    logger.info('LAN sync disabled');
    return null;
  }
  if (!options.token) {
    logger.warn('LAN sync refused to start without a token');
    return null;
  }

  currentDb = db;
  currentToken = options.token;
  currentPort = options.port || DEFAULT_PORT;

  server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      logger.error('Sync request handler crashed', err);
      try {
        res.writeHead(500);
        res.end('Internal Error');
      } catch {
        /* connection already closed */
      }
    });
  });

  server.on('error', (err) => {
    logger.error('LAN sync server error', err);
  });

  server.listen(currentPort, '0.0.0.0');
  const addresses = getLanAddresses().map((addr) => `http://${addr}:${currentPort}`);
  logger.info('LAN sync server started', { port: currentPort, addresses });
  return { url: addresses, port: currentPort };
}

export function stopSyncServer(): void {
  if (server) {
    server.close();
    server = null;
    currentDb = null;
    currentToken = '';
    logger.info('LAN sync server stopped');
  }
}

export function getSyncServerStatus(): {
  enabled: boolean;
  port: number;
  addresses: string[];
  hasToken: boolean;
} {
  return {
    enabled: server !== null,
    port: currentPort,
    addresses: getLanAddresses(),
    hasToken: currentToken.length > 0,
  };
}

/**
 * Build the pairing URL that mobile scans / pastes.
 * Format: `envoy://sync?url=<http-endpoint>&token=<token>` — mobile side
 * parses both fields with a single URL constructor call.
 */
export function buildPairingUrl(endpoint: string, token: string): string {
  return `envoy://sync?url=${encodeURIComponent(endpoint)}&token=${encodeURIComponent(token)}`;
}

/**
 * Renders a QR code containing the pairing URL, writes it to
 * userData/sync-qr.png, and hands it off to the OS image viewer.
 * Users scan with any modern phone camera and paste the decoded string
 * into Envoy Mobile's LAN Sync section, which auto-parses url + token.
 */
export async function generateAndOpenPairingQr(): Promise<{
  success: boolean;
  path?: string;
  pairingUrl?: string;
  error?: string;
}> {
  if (!server) {
    return { success: false, error: 'LAN sync server is not running' };
  }
  const addresses = getLanAddresses();
  if (addresses.length === 0) {
    return { success: false, error: 'No LAN address detected' };
  }
  if (!currentToken) {
    return { success: false, error: 'No token set' };
  }

  const endpoint = `http://${addresses[0]}:${currentPort}`;
  const pairingUrl = buildPairingUrl(endpoint, currentToken);
  const outputPath = path.join(app.getPath('userData'), 'sync-qr.png');

  try {
    await QRCode.toFile(outputPath, pairingUrl, {
      errorCorrectionLevel: 'M',
      width: 512,
      margin: 2,
    });
    const errMsg = await shell.openPath(outputPath);
    if (errMsg) {
      logger.warn('Could not open QR image with default viewer', { errMsg });
    }
    return { success: true, path: outputPath, pairingUrl };
  } catch (err) {
    logger.error('generateAndOpenPairingQr failed', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'QR generation failed',
    };
  }
}
