import {inject, Injectable} from '@angular/core';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class ActiveLabelStorageService {
  private readonly ACTIVE_LABEL_UUID = 'app_active_label_uuid';

  private storage: StorageService = inject(StorageService);

  get activeLabelUuid(): string | undefined {
    return this.storage.get<string>(this.ACTIVE_LABEL_UUID) ?? undefined;
  }

  setActiveLabelUuid(uuid: string | undefined): void {
    if (uuid !== undefined) {
      this.storage.set(this.ACTIVE_LABEL_UUID, uuid);
    } else {
      this.storage.remove(this.ACTIVE_LABEL_UUID);
    }
  }
}
