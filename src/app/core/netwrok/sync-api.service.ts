import { Observable } from 'rxjs';

export interface SyncApiService<T, CreateReq = any, UpdateReq = any> {

  pullUpdates(lastSyncTime: string | null): Observable<T[]>;

  create(payload: CreateReq): Observable<T>;

  update(entityId: string, payload: UpdateReq): Observable<T>;

  delete(entityId: string): Observable<void>;

}
