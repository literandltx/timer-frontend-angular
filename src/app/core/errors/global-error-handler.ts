import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: any): void {
    try {
      console.error('Error: \n', JSON.stringify(error, null, 2));
    } catch (e) {
      console.error('Error: ', error);
    }
  }
}
