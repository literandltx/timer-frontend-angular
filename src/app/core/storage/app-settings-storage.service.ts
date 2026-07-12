import {inject, Injectable} from '@angular/core';
import {StorageService} from './storage.service';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class AppSettingsStorageService {
  private readonly THEME = 'app_settings_theme';

  private storage: StorageService = inject(StorageService);

  get theme(): Theme | null {
    return this.storage.get<Theme>(this.THEME);
  }

  setTheme(theme: Theme): void {
    this.storage.set(this.THEME, theme);
  }

  reset(): void {
    this.storage.remove(this.THEME);
  }

}
