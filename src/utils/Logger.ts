/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */

import { ERROR_LOG, INFO_LOG } from '../constants';
import { singleton } from 'tsyringe';

@singleton()
export default class Logger {
  private readonly errorLogger?: Console;

  constructor() {
    this.registerProcessListeners();
  }

  log(message?: any, ...optionalParams: any[]): void {
    if (INFO_LOG) {
      if (optionalParams.length > 0) {
        console.log(message, optionalParams);
      } else {
        console.log(message);
      }
    }
  }

  error(message?: any, ...optionalParams: any[]): void {
    if (ERROR_LOG) {
      if (optionalParams.length > 0) {
        console.error(message, optionalParams);
      } else {
        console.error(message);
      }
    }
  }

  registerProcessListeners(): void {
    process.on('uncaughtException', (error, origin) => {
      this.error('Uncaught exception', error, origin);
    });

    process.on('unhandledRejection', (reason) => {
      this.error('Unhandled rejection', reason);
    });

    process.on('exit', (code) => {
        this.log(`Process exiting... Code: ${code}`);
    });
  }
}
