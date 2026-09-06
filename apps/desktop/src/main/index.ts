import { app, BrowserWindow, ipcMain, protocol, net, session, shell } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { PythonBridge } from './python-bridge';
import { DatabaseService } from './services/database';
import { SQLiteDatabaseService } from './services/database-sqlite';
import { IDatabase } from './services/database.interface';
import { EmailService } from './services/email.service';
import { SchedulerService } from './services/scheduler.service';
import { ReminderService } from './services/reminder.service';
import { TeamsService } from './services/teams.service';
import { registerIpcHandlers } from './ipc-handlers';
import { initLogger, logger } from './services/logger';
import { isSafeExternalUrl } from './services/security';
import { startAutoUpdater, installUpdateNow } from './services/updater';
import { initSentry } from './services/sentry';
import { startAutoBackup } from './services/backup-scheduler';

initLogger();
initSentry();

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

let mainWindow: BrowserWindow | null = null;
let pythonBridge: PythonBridge | null = null;
let database: IDatabase | null = null;
let emailService: EmailService | null = null;
let schedulerService: SchedulerService | null = null;
let reminderService: ReminderService | null = null;
let teamsService: TeamsService | null = null;

function isDev(): boolean {
  return process.env.NODE_ENV === 'development' || !app.isPackaged;
}

function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const parsedUrl = new URL(request.url);
    const pathname = parsedUrl.pathname;
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const rendererRoot = path.join(__dirname, '..', 'renderer');
    const resolved = path.normalize(path.join(rendererRoot, relativePath));

    // Prevent path traversal outside renderer directory
    if (!resolved.startsWith(rendererRoot)) {
      logger.warn('Blocked path traversal in app:// protocol', { requested: relativePath });
      return new Response('Forbidden', { status: 403 });
    }

    const ext = path.extname(resolved).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
    };

    const response = await net.fetch(pathToFileURL(resolved).toString());
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const body = await response.arrayBuffer();
    return new Response(body, {
      headers: { 'Content-Type': contentType },
    });
  });
}

function installCspHeader(): void {
  const devConnect = isDev() ? " ws://localhost:5173 http://localhost:5173" : '';
  const scriptSrc = isDev() ? "'self' 'unsafe-inline'" : "'self'";
  const styleSrc = "'self' 'unsafe-inline'";
  const csp = [
    "default-src 'self' app:",
    `script-src ${scriptSrc} app:`,
    `style-src ${styleSrc} app:`,
    "img-src 'self' data: blob: app:",
    "font-src 'self' data: app:",
    `connect-src 'self' app:${devConnect} https://graph.microsoft.com https://login.microsoftonline.com`,
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY'],
        'Referrer-Policy': ['no-referrer'],
      },
    });
  });
}

function lockDownNavigation(win: BrowserWindow): void {
  win.webContents.on('will-navigate', (event, url) => {
    const isDevUrl = isDev() && url.startsWith('http://localhost:5173');
    const isAppUrl = url.startsWith('app://');
    if (!isDevUrl && !isAppUrl) {
      event.preventDefault();
      logger.warn('Blocked navigation', { url });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      shell.openExternal(url).catch((err) => logger.error('openExternal failed', err));
    } else {
      logger.warn('Blocked window.open with unsafe URL', { url });
    }
    return { action: 'deny' };
  });

  win.webContents.on('will-attach-webview', (event) => {
    event.preventDefault();
    logger.warn('Blocked webview attachment');
  });
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'ENVOY',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: true,
    },
    show: false,
  });

  lockDownNavigation(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev()) {
    logger.info('Loading dev URL: http://localhost:5173');
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    const rendererPath = path.join(__dirname, '../renderer/index.html');
    logger.info('Loading renderer', { rendererPath });
    await mainWindow.loadFile(rendererPath);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize(): Promise<void> {
  logger.info('Initializing Envoy');

  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'mysql') {
    logger.info('Using MySQL database');
    const mysqlDb = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'envoy',
    });
    await mysqlDb.initialize();
    database = mysqlDb as unknown as IDatabase;
    logger.info('MySQL database initialized');
  } else {
    logger.info('Using SQLite database (local storage)');
    const sqliteDb = new SQLiteDatabaseService();
    await sqliteDb.initialize();
    logger.info('SQLite database initialized', {
      dataPath: sqliteDb.getDataPath(),
      filesPath: sqliteDb.getFilesPath(),
    });
    database = sqliteDb as unknown as IDatabase;
  }

  pythonBridge = new PythonBridge();
  pythonBridge.start().catch((error) => {
    logger.error('Failed to start Python engine', error);
  });

  emailService = new EmailService();

  try {
    const savedAccounts = await database.listEmailAccounts();
    await emailService.loadAccountsFromDB(savedAccounts);
    logger.info('Loaded email accounts', { count: savedAccounts.length });
  } catch (error) {
    logger.error('Failed to load email accounts', error);
  }

  schedulerService = new SchedulerService(database as any, emailService, pythonBridge);
  schedulerService.start();
  logger.info('Scheduler service started');

  reminderService = new ReminderService(database as any);
  reminderService.start();
  logger.info('Reminder service started');

  teamsService = new TeamsService();
  schedulerService.setTeamsService(teamsService);
  try {
    const savedSettings = await database.getSettings();
    const teamsClientId = (savedSettings as any).teamsClientId;
    if (teamsClientId) {
      teamsService.configure(teamsClientId);
      logger.info('Teams service configured');
    }
  } catch (err) {
    logger.error('Failed to load Teams config', err);
  }

  registerIpcHandlers(ipcMain, database as any, pythonBridge, emailService, reminderService, teamsService);
  logger.info('IPC handlers registered');

  try {
    const savedSettingsForBackup = await database.getSettings();
    const autoBackupSettings = (savedSettingsForBackup as any).autoBackup;
    if (autoBackupSettings) {
      startAutoBackup(database as any, autoBackupSettings);
    }
  } catch (err) {
    logger.error('Failed to start auto-backup scheduler', err);
  }
}

app.on('ready', async () => {
  try {
    installCspHeader();
    if (!isDev()) {
      registerAppProtocol();
      logger.info('Registered app:// protocol');
    }
    await initialize();
    await createWindow();
    startAutoUpdater(mainWindow);
    ipcMain.handle('updater:install', () => installUpdateNow());
  } catch (error) {
    logger.error('Failed to initialize app', error);
    app.quit();
  }
});

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => event.preventDefault());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (mainWindow === null) {
    await createWindow();
  }
});

app.on('before-quit', async (event) => {
  if (reminderService) reminderService.stop();
  if (schedulerService) schedulerService.stop();
  if (pythonBridge) pythonBridge.stop();
  if (emailService) emailService.close();
  if (database) {
    event.preventDefault();
    await database.close();
    app.exit(0);
  }
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', reason);
});

export { mainWindow, pythonBridge, database, schedulerService, reminderService };
