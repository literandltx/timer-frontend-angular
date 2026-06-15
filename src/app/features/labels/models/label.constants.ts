import { Label } from './label.model';

const NOW = new Date().toISOString();

export const DEFAULT_LABELS: Label[] = [
  {
    uuid: 'default-1',
    userId: 0,
    name: 'Work',
    color: '#ef4444',
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false
  },
  {
    uuid: 'default-2',
    userId: 0,
    name: 'Study',
    color: '#3b82f6',
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false
  },
  {
    uuid: 'default-3',
    userId: 0,
    name: 'Chill',
    color: '#10b981',
    createdAt: NOW,
    updatedAt: NOW,
    deleted: false
  },
];
