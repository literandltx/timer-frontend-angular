import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SyncApiService } from '../../../core/netwrok/sync-api.service';
import { TimerSetting, TimerSettingRequest } from '../models/timer-setting.model';

@Injectable({
  providedIn: 'root'
})
export class TimerSettingsApiService implements SyncApiService<TimerSetting, TimerSettingRequest, TimerSettingRequest> {
  private http = inject(HttpClient);

  pullUpdates(apiUrl: string, lastSyncTime: string | null): Observable<TimerSetting[]> {
    let params = new HttpParams();
    if (lastSyncTime) {
      params = params.set('updatedAfter', lastSyncTime);
    }
    return this.http.get<TimerSetting[]>(apiUrl, { params });
  }

  create(apiUrl: string, payload: TimerSettingRequest): Observable<TimerSetting> {
    return this.http.post<TimerSetting>(apiUrl, payload);
  }

  update(apiUrl: string, entityId: string, payload: TimerSettingRequest): Observable<TimerSetting> {
    return this.http.put<TimerSetting>(`${apiUrl}/${entityId}`, payload);
  }

  delete(apiUrl: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${apiUrl}/${entityId}`);
  }
}
