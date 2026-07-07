import {Injectable} from "@angular/core";

@Injectable({providedIn: "root"})
export class LogService {

  debug(..._args: unknown[]): void {
  }

  info(..._args: unknown[]): void {
  }

  warn(..._args: unknown[]): void {
  }

  error(...args: unknown[]): void {
    console.error(...args);
  }

  log(..._args: unknown[]): void {
  }

  table(..._args: unknown[]): void {
  }

  trace(..._args: unknown[]): void {
  }

}
