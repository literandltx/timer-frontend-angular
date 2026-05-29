import {ErrorHandler, Injectable} from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    try {
      console.error('Error: \n', JSON.stringify(error, null, 2));
    } catch {
      console.error('Error: ', error);
    }
  }
}
