import { app, BrowserWindow, ipcMain, protocol, net } from 'electron';
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

// Register custom protocol scheme - must be done before app ready
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

// Keep references to prevent garbage collection
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

// Register custom protocol for production to handle ES modules properly
function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    // Parse the URL to get the pathname
    const parsedUrl = new URL(request.url);
    const pathname = parsedUrl.pathname;
    // Remove leading slash and get the file path
    const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const filePath = path.join(__dirname, '..', 'renderer', relativePath);
    console.log('Protocol request:', request.url, '-> file:', filePath);

    // Determine MIME type based on file extension
    const ext = path.extname(filePath).toLowerCase();
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

    const response = await net.fetch(pathToFileURL(filePath).toString());
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Create new response with correct content type
    const body = await response.arrayBuffer();
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
      },
    });
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
      sandbox: false,
    },
    show: false, // Show when ready
  });

  // Show window when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev()) {
    console.log('Loading dev URL: http://localhost:5173');
    await mainWindow.loadURL('http://localhost:5173');
  } else {
    const rendererPath = path.join(__dirname, '../renderer/index.html');
    console.log('Loading renderer from:', rendererPath);
    await mainWindow.loadFile(rendererPath);
  }

  // Open DevTools in development only
  if (isDev()) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize(): Promise<void> {
  console.log('Initializing Envoy...');

  // Initialize database
  // Default: SQLite for local-first storage (no server needed)
  // Set DB_TYPE=mysql to use MySQL server instead
  const dbType = process.env.DB_TYPE || 'sqlite';

  if (dbType === 'mysql') {
    // MySQL mode - requires running MySQL server
    console.log('Using MySQL database...');
    const mysqlDb = new DatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'envoy',
    });
    await mysqlDb.initialize();
    database = mysqlDb as unknown as IDatabase;
    console.log('MySQL database initialized');
  } else {
    // SQLite mode - local file storage (like WhatsApp)
    console.log('Using SQLite database (local storage)...');
    const sqliteDb = new SQLiteDatabaseService();
    await sqliteDb.initialize();
    console.log(`SQLite database initialized at: ${sqliteDb.getDataPath()}`);
    console.log(`Files stored at: ${sqliteDb.getFilesPath()}`);
    database = sqliteDb as unknown as IDatabase;
  }

  // Initialize Python bridge
  pythonBridge = new PythonBridge();

  // Don't block startup if Python fails - we'll handle it gracefully
  pythonBridge.start().catch((error) => {
    console.error('Failed to start Python engine:', error);
  });

  // Initialize Email service
  emailService = new EmailService();

  // Load saved email accounts from database
  try {
    const savedAccounts = await database.listEmailAccounts();
    await emailService.loadAccountsFromDB(savedAccounts);
    console.log(`Loaded ${savedAccounts.length} email accounts`);
  } catch (error) {
    console.error('Failed to load email accounts:', error);
  }

  // Initialize Scheduler service for scheduled message sending
  schedulerService = new SchedulerService(database as any, emailService, pythonBridge);
  schedulerService.start();
  console.log('Scheduler service started');

  // Initialize Reminder service for notifications
  reminderService = new ReminderService(database as any);
  reminderService.start();
  console.log('Reminder service started');

  // Initialize Teams service (Graph API integration) and wire to scheduler
  teamsService = new TeamsService();
  schedulerService.setTeamsService(teamsService);
  // Configure with saved client ID if available
  try {
    const savedSettings = await database.getSettings();
    const teamsClientId = (savedSettings as any).teamsClientId;
    if (teamsClientId) {
      teamsService.configure(teamsClientId);
      console.log('Teams service configured');
    }
  } catch (err) {
    console.error('Failed to load Teams config:', err);
  }

  // Register IPC handlers
  registerIpcHandlers(ipcMain, database as any, pythonBridge, emailService, reminderService, teamsService);
  console.log('IPC handlers registered');
}

// App event handlers
app.on('ready', async () => {
  try {
    // Register app:// protocol for production builds
    if (!isDev()) {
      registerAppProtocol();
      console.log('Registered app:// protocol');
    }
    await initialize();
    await createWindow();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, apps typically stay open until explicitly quit
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, re-create window when dock icon is clicked
  if (mainWindow === null) {
    await createWindow();
  }
});

app.on('before-quit', async (event) => {
  // Cleanup
  if (reminderService) {
    reminderService.stop();
  }
  if (schedulerService) {
    schedulerService.stop();
  }
  if (pythonBridge) {
    pythonBridge.stop();
  }
  if (emailService) {
    emailService.close();
  }
  if (database) {
    event.preventDefault();
    await database.close();
    app.exit(0);
  }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// Export for testing
export { mainWindow, pythonBridge, database, schedulerService, reminderService };
