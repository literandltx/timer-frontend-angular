import {inject, Injectable} from "@angular/core";
import {LogService} from '../log/log.service';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private log = inject(LogService);

  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) as T : null;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      this.log.error('Storage set failed', e);
    }
  }

  keys(prefix?: string): string[] {
    return Object.keys(localStorage).filter(key => !prefix || key.startsWith(prefix));
  }

  removeByPrefix(prefix: string): void {
    this.keys(prefix).forEach(key => localStorage.removeItem(key));
  }

  remove(key: string): void {
    localStorage.removeItem(key);
  }

}
