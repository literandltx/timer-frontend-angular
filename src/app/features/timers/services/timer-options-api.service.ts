import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SyncApiService } from '../../../core/netwrok/sync-api.service';
import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from '../models/timer-option.model';

@Injectable({
  providedIn: 'root'
})
export class TimerOptionsApiService implements SyncApiService<TimerOption, CreateTimerOptionRequest, UpdateTimerOptionRequest> {
  private http = inject(HttpClient);

  pullUpdates(apiUrl: string, lastSyncTime: string | null): Observable<TimerOption[]> {
    let params = new HttpParams();
    if (lastSyncTime) {
      params = params.set('updatedAfter', lastSyncTime);
    }
    return this.http.get<TimerOption[]>(apiUrl, { params });
  }

  create(apiUrl: string, payload: CreateTimerOptionRequest): Observable<TimerOption> {
    return this.http.post<TimerOption>(apiUrl, payload);
  }

  update(apiUrl: string, entityId: string, payload: UpdateTimerOptionRequest): Observable<TimerOption> {
    return this.http.put<TimerOption>(`${apiUrl}/${entityId}`, payload);
  }

  delete(apiUrl: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${apiUrl}/${entityId}`);
  }
}
