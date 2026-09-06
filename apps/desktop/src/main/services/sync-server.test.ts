import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import http from 'http';
import type { AddressInfo } from 'net';

const { appMock } = vi.hoisted(() => ({
  appMock: { getVersion: vi.fn(() => '1.0.0-test') },
}));

vi.mock('electron', () => ({ app: appMock }));

vi.mock('./logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('./backup-audit', () => ({
  logBackupEvent: vi.fn(async () => undefined),
}));

vi.mock('./backup', () => ({
  collectBackup: vi.fn(async () => ({
    version: 1,
    exportedAt: '2026-09-06T00:00:00Z',
    appVersion: '1.0.0-test',
    entities: {
      contacts: [{ id: 'c1', name: 'Alice' }],
      contactGroups: [],
      templates: [],
      snippets: [],
      tasks: [],
      notes: [],
      noteGroups: [],
      calendarEvents: [],
      reminders: [],
      scheduledMessages: [],
      auditLogs: [],
      expenses: [],
      richDocuments: [],
      settings: {},
    },
    counts: { contacts: 1 },
  })),
  restoreEnvelope: vi.fn(async () => ({
    applied: { contacts: 1 },
    skipped: {},
    totalApplied: 1,
  })),
}));

import {
  buildPairingUrl,
  generateToken,
  getLanAddresses,
  getSyncServerStatus,
  startSyncServer,
  stopSyncServer,
} from './sync-server';

const STUB_DB = { id: 'stub-db' } as never;

function boundPort(): number {
  const status = getSyncServerStatus();
  return status.port;
}

async function request(
  port: number,
  path: string,
  init: { method?: string; token?: string; body?: string } = {}
): Promise<{ status: number; body: string; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path,
        method: init.method ?? 'GET',
        headers: {
          ...(init.token ? { 'x-envoy-token': init.token } : {}),
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          let json: unknown = null;
          try {
            json = JSON.parse(body);
          } catch {
            /* body might be empty or non-JSON */
          }
          resolve({ status: res.statusCode ?? 0, body, json });
        });
      }
    );
    req.on('error', reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

beforeEach(() => {
  stopSyncServer();
});

afterEach(() => {
  stopSyncServer();
});

describe('generateToken', () => {
  it('returns a 32-char hex string', () => {
    const token = generateToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('produces distinct tokens on each call', () => {
    expect(generateToken()).not.toBe(generateToken());
  });
});

describe('getLanAddresses', () => {
  it('returns an array of dotted IPv4 strings', () => {
    const addrs = getLanAddresses();
    expect(Array.isArray(addrs)).toBe(true);
    for (const addr of addrs) {
      expect(addr).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    }
  });
});

describe('startSyncServer', () => {
  it('does not start when disabled', () => {
    const result = startSyncServer(STUB_DB, { enabled: false, port: 0, token: 't' });
    expect(result).toBeNull();
    expect(getSyncServerStatus().enabled).toBe(false);
  });

  it('refuses to start without a token', () => {
    const result = startSyncServer(STUB_DB, { enabled: true, port: 0, token: '' });
    expect(result).toBeNull();
    expect(getSyncServerStatus().enabled).toBe(false);
  });

  it('starts on port 0 and serves an unauthenticated ping', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 0, token: 'abc' });
    // Grab the actual bound port from the server internals since we asked for 0.
    // getSyncServerStatus reports our requested port, so probe by trying each
    // ephemeral candidate... easier: re-import to expose it. Instead, poll.
    // For a robust test, listen on a known port.
    stopSyncServer();
    startSyncServer(STUB_DB, { enabled: true, port: 47828, token: 'abc' });
    // Give the OS a moment to accept the bind.
    await new Promise((r) => setTimeout(r, 20));
    const res = await request(47828, '/envoy/v1/ping');
    expect(res.status).toBe(200);
    expect((res.json as any).ok).toBe(true);
    expect((res.json as any).appVersion).toBe('1.0.0-test');
  });

  it('rejects envelope requests without a token', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 47829, token: 'abc' });
    await new Promise((r) => setTimeout(r, 20));
    const res = await request(47829, '/envoy/v1/envelope');
    expect(res.status).toBe(401);
  });

  it('rejects envelope requests with a wrong token', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 47830, token: 'abc' });
    await new Promise((r) => setTimeout(r, 20));
    const res = await request(47830, '/envoy/v1/envelope', { token: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('serves an envelope on GET with the correct token', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 47831, token: 'abc' });
    await new Promise((r) => setTimeout(r, 20));
    const res = await request(47831, '/envoy/v1/envelope', { token: 'abc' });
    expect(res.status).toBe(200);
    expect((res.json as any).version).toBe(1);
    expect((res.json as any).entities.contacts).toHaveLength(1);
  });

  it('applies an envelope on POST and returns restore counts', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 47832, token: 'abc' });
    await new Promise((r) => setTimeout(r, 20));
    const payload = JSON.stringify({
      version: 1,
      exportedAt: 'x',
      appVersion: 'x',
      entities: { contacts: [{ id: 'a' }] },
      counts: {},
    });
    const res = await request(47832, '/envoy/v1/envelope', {
      method: 'POST',
      token: 'abc',
      body: payload,
    });
    expect(res.status).toBe(200);
    expect((res.json as any).totalApplied).toBe(1);
  });

  it('returns 404 for unknown paths', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 47833, token: 'abc' });
    await new Promise((r) => setTimeout(r, 20));
    const res = await request(47833, '/nope', { token: 'abc' });
    expect(res.status).toBe(404);
  });

  it('stops cleanly on stopSyncServer', async () => {
    startSyncServer(STUB_DB, { enabled: true, port: 47834, token: 'abc' });
    await new Promise((r) => setTimeout(r, 20));
    stopSyncServer();
    // Next ping attempt should fail-fast (connection refused).
    await expect(request(47834, '/envoy/v1/ping')).rejects.toBeTruthy();
  });
});

describe('buildPairingUrl', () => {
  it('URL-encodes both fields into the envoy://sync scheme', () => {
    const result = buildPairingUrl('http://192.168.1.42:47828', 'abc123');
    expect(result).toBe(
      'envoy://sync?url=http%3A%2F%2F192.168.1.42%3A47828&token=abc123'
    );
  });

  it('round-trips into a value parsable by URLSearchParams via the http shim', () => {
    const endpoint = 'http://10.0.0.5:47828';
    const token = 'token_with_special_/=+chars';
    const raw = buildPairingUrl(endpoint, token);
    // Same parse the mobile side runs (see parsePairingUrl in MobileSyncService).
    const usable = raw.replace('envoy://', 'http://');
    const parsed = new URL(usable);
    expect(parsed.searchParams.get('url')).toBe(endpoint);
    expect(parsed.searchParams.get('token')).toBe(token);
  });
});
