import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from '../models/timer-option.model';
import {SyncApiService} from '../../../core/netwrok/sync-api.service';
import {environment} from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TimerOptionApiService implements SyncApiService<TimerOption, CreateTimerOptionRequest, UpdateTimerOptionRequest> {
  private http = inject(HttpClient);
  private endpoint = `${environment.base_url}/api/v1/timer-options`;

  pullUpdates(lastSyncTime: string | null): Observable<TimerOption[]> {
    let params = new HttpParams();
    if (lastSyncTime) {
      params = params.set('updatedAfter', lastSyncTime);
    }
    return this.http.get<TimerOption[]>(this.endpoint, {params});
  }

  save(payload: CreateTimerOptionRequest): Observable<TimerOption> {
    return this.http.post<TimerOption>(this.endpoint, payload);
  }

  update(entityId: string, payload: UpdateTimerOptionRequest): Observable<TimerOption> {
    return this.http.put<TimerOption>(`${this.endpoint}/${entityId}`, payload);
  }

  delete(entityId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${entityId}`);
  }
}
