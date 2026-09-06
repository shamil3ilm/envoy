import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';
import { logger } from './logger';

let started = false;

export function startAutoUpdater(win: BrowserWindow | null): void {
  if (started) return;
  started = true;

  if (!app.isPackaged) {
    logger.info('Auto-updater disabled in development');
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = logger;

  autoUpdater.on('checking-for-update', () => logger.info('Checking for updates'));
  autoUpdater.on('update-available', (info) => {
    logger.info('Update available', { version: info.version });
    win?.webContents.send('updater:available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => logger.info('No updates available'));
  autoUpdater.on('download-progress', (progress) => {
    win?.webContents.send('updater:progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded', { version: info.version });
    win?.webContents.send('updater:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => logger.error('Auto-updater error', err));

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    logger.error('Initial update check failed', err);
  });

  const FOUR_HOURS = 4 * 60 * 60 * 1000;
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      logger.error('Periodic update check failed', err);
    });
  }, FOUR_HOURS);
}

export function installUpdateNow(): void {
  autoUpdater.quitAndInstall();
}
