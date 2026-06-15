import {Injectable, inject} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Label, CreateLabelRequest, UpdateLabelRequest} from '../models/label.model';
import {SyncApiService} from '../../../core/netwrok/sync-api.service';

@Injectable({
  providedIn: 'root'
})
export class LabelApiService implements SyncApiService<Label, CreateLabelRequest, UpdateLabelRequest> {
  private http = inject(HttpClient);

  pullDeltaUpdates(apiUrl: string, lastSyncTime: string): Observable<Label[]> {
    return this.http.get<Label[]>(`${apiUrl}?updatedAfter=${lastSyncTime}`);
  }

  create(apiUrl: string, payload: CreateLabelRequest): Observable<Label> {
    return this.http.post<Label>(apiUrl, payload);
  }

  update(apiUrl: string, entityId: string, payload: UpdateLabelRequest): Observable<Label> {
    return this.http.put<Label>(`${apiUrl}/${entityId}`, payload);
  }

  delete(apiUrl: string, entityId: string): Observable<void> {
    return this.http.delete<void>(`${apiUrl}/${entityId}`);
  }
}
