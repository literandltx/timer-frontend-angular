import {SyncEntity} from '../../../core/models/sync-entity.model';

export interface Label extends SyncEntity {
  userId?: number;
  name: string;
  color: string;
}

export interface CreateLabelRequest {
  uuid: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateLabelRequest {
  name: string;
  color: string;
  updatedAt: string;
}

export interface LabelSyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: unknown;
  labelUuid?: string;
}
