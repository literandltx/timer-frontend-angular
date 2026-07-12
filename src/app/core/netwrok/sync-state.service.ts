import {inject, Injectable} from '@angular/core';
import {StorageService} from '../storage/storage.service';

@Injectable({providedIn: 'root'})
export class SyncTimestampService {
  private readonly PREFIX: string = 'last_sync_';

  private storage: StorageService = inject(StorageService);

  update(entityType: string): void {
    this.storage.set(this.getKey(entityType), new Date().toISOString());
  }

  get(entityType: string): string | null {
    return this.storage.get<string>(this.getKey(entityType));
  }

  clear(entityType: string): void {
    this.storage.remove(this.getKey(entityType));
  }

  clearAll(): void {
    this.storage.removeByPrefix(this.PREFIX);
  }

  private getKey(entityType: string): string {
    return `${this.PREFIX}${entityType.toLowerCase()}`;
  }
}
