import { Observable } from 'rxjs';

export interface SyncApiService<T, CreateReq = unknown, UpdateReq = unknown> {

  pullUpdates(lastSyncTime: string | null): Observable<T[]>;

  save(payload: CreateReq): Observable<T>;

  update(entityId: string, payload: UpdateReq): Observable<T>;

  delete(entityId: string): Observable<void>;

}
