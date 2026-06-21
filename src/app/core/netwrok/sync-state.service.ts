import {Injectable} from '@angular/core';

@Injectable({providedIn: 'root'})
export class SyncTimestampService {

  private readonly PREFIX: string = 'last_sync_';

  update(entityType: string): void {
    localStorage.setItem(this.getKey(entityType), new Date().toISOString());
  }

  get(entityType: string): string | null {
    return localStorage.getItem(this.getKey(entityType));
  }

  clear(entityType: string): void {
    localStorage.removeItem(this.getKey(entityType));
  }

  clearAll(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }

  private getKey(entityType: string): string {
    return `${this.PREFIX}${entityType.toLowerCase()}`;
  }
}
