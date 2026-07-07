import {ErrorHandler, Injectable, inject} from '@angular/core';
import {LogService} from '../log/log.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private log: LogService = inject(LogService);

  handleError(error: unknown): void {
    try {
      this.log.error('Error: \n', JSON.stringify(error, null, 2));
    } catch {
      this.log.error('Error: ', error);
    }
  }
}
