import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  TimerEntry,
  CreateTimerEntryRequest,
  UpdateTimerEntryRequest
} from '../models/timer-entry.model';
import {SyncApiService} from '../../../core/netwrok/sync-api.service';
import {environment} from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimerEntryApiService implements SyncApiService<TimerEntry, CreateTimerEntryRequest, UpdateTimerEntryRequest> {
  private http = inject(HttpClient);
  private endpoint = `${environment.base_url}/api/v1/timer-entries`;

  pullUpdates(lastSyncTime: string | null): Observable<TimerEntry[]> {
    let params = new HttpParams();
    if (lastSyncTime) {
      params = params.set('updatedAfter', lastSyncTime);
    }
    return this.http.get<TimerEntry[]>(this.endpoint, {params});
  }

  save(payload: CreateTimerEntryRequest): Observable<TimerEntry> {
    return this.http.post<TimerEntry>(this.endpoint, payload);
  }

  update(entityId: string, payload: UpdateTimerEntryRequest): Observable<TimerEntry> {
    return this.http.put<TimerEntry>(`${this.endpoint}/${entityId}`, payload);
  }

  delete(entityId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${entityId}`);
  }
}
