import { Observable } from 'rxjs';

export interface SyncApiService<T, CreateReq = any, UpdateReq = any> {

  pullDeltaUpdates(apiUrl: string, lastSyncTime: string): Observable<T[]>;

  create(apiUrl: string, payload: CreateReq): Observable<T>;

  update(apiUrl: string, entityId: string, payload: UpdateReq): Observable<T>;

  delete(apiUrl: string, entityId: string): Observable<void>;

}
