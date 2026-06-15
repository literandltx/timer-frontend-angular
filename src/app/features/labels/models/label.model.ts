export interface Label {
  uuid: string;
  userId?: number;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
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

export interface SyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: any;
  labelUuid?: string;
}
