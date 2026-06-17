import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SyncApiService } from '../../../core/netwrok/sync-api.service';
import { TimerEntry, CreateTimerEntryRequest, UpdateTimerEntryRequest } from '../models/timer-entry.model';

@Injectable({
  providedIn: 'root'
})
export class TimerEntryApiService implements SyncApiService<TimerEntry, CreateTimerEntryRequest, UpdateTimerEntryRequest> {
  private http = inject(HttpClient);

  pullUpdates(apiUrl: string, lastSyncTime: string | null): Observable<TimerEntry[]> {
    let params = new HttpParams();
    if (lastSyncTime) {
      params = params.set('updatedAfter', lastSyncTime);
    }
    return this.http.get<TimerEntry[]>(apiUrl, { params });
  }

  create(apiUrl: string, payload: CreateTimerEntryRequest): Observable<TimerEntry> {
    return this.http.post<TimerEntry>(apiUrl, payload);
  }

  update(apiUrl: string, entityId: string, payload: UpdateTimerEntryRequest): Observable<TimerEntry> {
    return this.http.put<TimerEntry>(`${apiUrl}/${entityId}`, payload);
  }

  delete(apiUrl: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${apiUrl}/${entityId}`);
  }
}
