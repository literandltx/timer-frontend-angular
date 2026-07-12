import {inject, Injectable} from '@angular/core';
import {StorageService} from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class DeviceStorageService {
  private readonly DEVICE_UUID = 'app_device_uuid';

  private storage: StorageService = inject(StorageService);

  getOrCreateDeviceUuid(): string {
    let uuid = this.storage.get<string>(this.DEVICE_UUID);

    if (!uuid) {
      uuid = crypto.randomUUID();
      this.storage.set(this.DEVICE_UUID, uuid);
    }

    return uuid;
  }

  reset(): void {
    this.storage.remove(this.DEVICE_UUID);
  }

}
