import {Injectable, inject} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {Observable} from 'rxjs';
import {Label, CreateLabelRequest, UpdateLabelRequest} from '../models/label.model';
import {SyncApiService} from '../../../core/netwrok/sync-api.service';
import {environment} from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LabelApiService implements SyncApiService<Label, CreateLabelRequest, UpdateLabelRequest> {
  private http = inject(HttpClient);

  private endpoint = `${environment.apiUrl}/labels`;

  pullUpdates(lastSyncTime: string | null): Observable<Label[]> {
    let params = new HttpParams();
    if (lastSyncTime) {
      params = params.set('updatedAfter', lastSyncTime);
    }
    return this.http.get<Label[]>(this.endpoint, {params});
  }

  create(payload: CreateLabelRequest): Observable<Label> {
    return this.http.post<Label>(this.endpoint, payload);
  }

  update(entityId: string, payload: UpdateLabelRequest): Observable<Label> {
    return this.http.put<Label>(`${this.endpoint}/${entityId}`, payload);
  }

  delete(entityId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint}/${entityId}`);
  }
}
