import {inject, Injectable} from '@angular/core';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class InitStorageService {
  private readonly IS_INITED = 'app_is_inited';
  private readonly IS_DB_SEEDED = 'app_db_seeded_v1';

  private storage: StorageService = inject(StorageService);

  get isInited(): boolean {
    return this.storage.get<boolean>(this.IS_INITED) ?? false;
  }

  markInited(): void {
    this.storage.set(this.IS_INITED, true);
  }

  get isDatabaseSeeded(): boolean {
    return this.storage.get<boolean>(this.IS_DB_SEEDED) ?? false;
  }

  markDatabaseSeeded(): void {
    this.storage.set(this.IS_DB_SEEDED, true);
  }

  reset(): void {
    this.storage.remove(this.IS_INITED);
    this.storage.remove(this.IS_DB_SEEDED);
  }

}
