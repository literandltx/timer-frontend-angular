import { Observable } from 'rxjs';
import {Label} from '../../features/labels/models/label.model';

export interface SyncApiService<T, CreateReq = any, UpdateReq = any> {

  pullUpdates(apiUrl: string, lastSyncTime: string | null): Observable<Label[]>;

  create(apiUrl: string, payload: CreateReq): Observable<T>;

  update(apiUrl: string, entityId: string, payload: UpdateReq): Observable<T>;

  delete(apiUrl: string, entityId: string): Observable<void>;

}
