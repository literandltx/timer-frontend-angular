import {Injectable, isDevMode} from '@angular/core';

export enum AppEventType {
  DATA_FETCH = 'DATA_FETCH',
  ACTION_SUCCESS = 'ACTION_SUCCESS',
  ERROR = 'ERROR'
}

@Injectable({providedIn: 'root'})
export class AnalyticsService {

  log(type: AppEventType, message: string, data?: any) {
    const payload = {
      timestamp: new Date().toISOString(),
      type,
      message,
      detail: data
    };

    if (isDevMode()) {
      const color = this.getLogColor(type);
      console.log(`%c[${type}] %c${message}`, `color: ${color}; font-weight: bold;`, 'color: inherit;', data || '');
    } else {
      // TODO: add analytic service
    }
  }

  private getLogColor(type: AppEventType): string {
    switch (type) {
      case AppEventType.ERROR:
        return '#ff4d4d';
      case AppEventType.ACTION_SUCCESS:
        return '#2ecc71';
      case AppEventType.DATA_FETCH:
        return '#3498db';
      default:
        return '#95a5a6';
    }
  }
}
