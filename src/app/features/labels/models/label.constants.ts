import {CreateLabelRequest} from './label.model';

export const DEFAULT_LABELS: Partial<CreateLabelRequest>[] = [
  {
    name: 'Work',
    color: '#ef4444',
  },
  {
    name: 'Study',
    color: '#3b82f6',
  },
  {
    name: 'Chill',
    color: '#10b981',
  },
];
