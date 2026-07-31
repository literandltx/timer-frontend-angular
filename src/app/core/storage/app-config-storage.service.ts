import { inject, Injectable } from '@angular/core';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';
export type ChartType = 'pie' | 'bar';

@Injectable({
  providedIn: 'root'
})
export class AppConfigStorageService {
  private storage: StorageService = inject(StorageService);

  private readonly KEYS = {
    LAST_VISITED: 'app_flow_last_visited',
    DEVICE_UUID: 'app_device_uuid',

    THEME: 'app_settings_theme',
    PREFERRED_CHART_TYPE: 'app_preferred_chart_type',

    IS_INITED: 'app_is_inited',
    IS_DB_SEEDED: 'app_db_seeded_v1',
    HAS_SESSION: 'hasSession'
  };

  // --- App Flow ---
  get lastVisited(): string | null {
    return this.storage.get<string>(this.KEYS.LAST_VISITED);
  }
  setLastVisited(route: string): void {
    this.storage.set(this.KEYS.LAST_VISITED, route);
  }

  // --- Session State ---
  get hasSession(): boolean {
    return this.storage.get<boolean>(this.KEYS.HAS_SESSION) ?? false;
  }

  setHasSession(hasSession: boolean): void {
    this.storage.set(this.KEYS.HAS_SESSION, hasSession);
  }

  // --- Theme ---
  get theme(): Theme | null {
    return this.storage.get<Theme>(this.KEYS.THEME);
  }
  setTheme(theme: Theme): void {
    this.storage.set(this.KEYS.THEME, theme);
  }

  // --- Chart Preferences ---
  get preferredChartType(): ChartType {
    return this.storage.get<ChartType>(this.KEYS.PREFERRED_CHART_TYPE) ?? 'pie';
  }
  setPreferredChartType(type: ChartType): void {
    this.storage.set(this.KEYS.PREFERRED_CHART_TYPE, type);
  }

  // --- Device Storage ---
  getOrCreateDeviceUuid(): string {
    let uuid = this.storage.get<string>(this.KEYS.DEVICE_UUID);
    if (!uuid) {
      uuid = crypto.randomUUID();
      this.storage.set(this.KEYS.DEVICE_UUID, uuid);
    }
    return uuid;
  }

  // --- Initialization & Database ---
  get isInited(): boolean {
    return this.storage.get<boolean>(this.KEYS.IS_INITED) ?? false;
  }
  markInited(): void {
    this.storage.set(this.KEYS.IS_INITED, true);
  }

  get isDatabaseSeeded(): boolean {
    return this.storage.get<boolean>(this.KEYS.IS_DB_SEEDED) ?? false;
  }
  markDatabaseSeeded(): void {
    this.storage.set(this.KEYS.IS_DB_SEEDED, true);
  }
}
