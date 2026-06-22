export enum SyncAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export interface SyncMessage<T> {
  action: SyncAction;
  payload: T;
}
