import { Injectable } from "@angular/core";

export enum LogLevel {
  debug = 0,
  info = 1,
  warn = 2,
  error = 3,
  none = 4,
}

@Injectable({ providedIn: "root" })
export class LogService {
  debug(...args: unknown[]): void {
    console.debug(...args);
  }
  info(...args: unknown[]): void {
    console.info(...args);
  }
  warn(...args: unknown[]): void {
    console.warn(...args);
  }
  error(...args: unknown[]): void {
    console.error(...args);
  }
  log(...args: unknown[]): void {
    console.log(...args);
  }
  table(...args: unknown[]): void {
    console.table(...args);
  }
  trace(...args: unknown[]): void {
    console.trace(...args);
  }
}
