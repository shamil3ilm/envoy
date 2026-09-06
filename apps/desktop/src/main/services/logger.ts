import log from 'electron-log/main';
import { app } from 'electron';
import path from 'path';

let initialized = false;

export function initLogger(): void {
  if (initialized) return;
  initialized = true;

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  log.transports.file.resolvePathFn = () =>
    path.join(app.getPath('userData'), 'logs', 'main.log');
  log.transports.file.maxSize = 10 * 1024 * 1024;
  log.transports.file.level = 'info';
  log.transports.console.level = isDev ? 'debug' : false;

  log.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error }) => {
      log.error('uncaught', error);
    },
  });
}

export const logger = log;
export default log;
