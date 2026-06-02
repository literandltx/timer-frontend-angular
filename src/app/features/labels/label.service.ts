import {Injectable, signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {Label, CreateLabelRequest} from './label.model';
import {BaseOfflineSyncService} from '../../core/service/base-offline-sync.service';
import {HttpErrorResponse} from '@angular/common/http';

interface SyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: CreateLabelRequest;
  labelId?: number;
  tempId?: number;
}

const DEFAULT_LABELS: Label[] = [
  {id: 1, userId: 0, name: 'Work', color: '#ef4444'},
  {id: 2, userId: 0, name: 'Study', color: '#3b82f6'},
  {id: 3, userId: 0, name: 'Chill', color: '#10b981'},
];

@Injectable({providedIn: 'root'})
export class LabelService extends BaseOfflineSyncService<SyncAction> {
  protected pingUrl = 'http://localhost:8080/api/v1/labels';
  protected queueKey = 'label_sync_queue';

  labels = signal<Label[]>([]);

  loadLabels() {
    this.labels.set(this.getLocalLabels());

    if (this.isOnline() && this.getQueue().length === 0 && this.authService.isAuthenticated()) {
      this.http.get<Label[]>(this.pingUrl).subscribe({
        next: (data) => {
          this.setLocalLabels(data);
          this.labels.set(data);
        },
        error: (err) => console.error('Background fetch failed', err)
      });
    }
  }

  async save(label: CreateLabelRequest) {
    const tempId = -Date.now();
    const newLabel: Label = {...label, id: tempId, userId: 0};

    this.updateLocalState(labels => [...labels, newLabel]);
    this.enqueueAction({type: 'CREATE', payload: label, tempId});
  }

  async update(id: number, request: CreateLabelRequest) {
    this.updateLocalState(labels =>
      labels.map(l => l.id === id ? {...l, ...request} : l)
    );

    const queue = this.getQueue();
    const pendingCreate = queue.find(a => a.type === 'CREATE' && a.tempId === id);

    if (pendingCreate) {
      pendingCreate.payload = request;
      this.setQueue(queue);
    } else {
      this.enqueueAction({type: 'UPDATE', labelId: id, payload: request});
    }
  }

  async delete(id: number) {
    this.updateLocalState(labels => labels.filter(l => l.id !== id));

    const queue = this.getQueue();
    if (id < 0) {
      this.setQueue(queue.filter(a => !(a.tempId === id || a.labelId === id)));
    } else {
      this.enqueueAction({type: 'DELETE', labelId: id});
    }
  }

  protected async syncQueue() {
    if (!this.isOnline() || this.isSyncing() || !this.authService.isAuthenticated()) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.isSyncing.set(true);

    try {
      for (let i = 0; i < queue.length; i++) {
        const action = queue[i];

        try {
          if (action.type === 'CREATE') {
            const saved = await firstValueFrom(this.http.post<Label>(this.pingUrl, action.payload));
            this.replaceLocalId(action.tempId!, saved.id);
            this.updateQueueIds(action.tempId!, saved.id);
          } else if (action.type === 'UPDATE') {
            await firstValueFrom(this.http.put<Label>(`${this.pingUrl}/${action.labelId}`, action.payload));
          } else if (action.type === 'DELETE') {
            await firstValueFrom(this.http.delete<void>(`${this.pingUrl}/${action.labelId}`));
          }

          this.setQueue(this.getQueue().filter(a => a.id !== action.id));

          if (i < queue.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1100));
          }

        } catch (err: unknown) {
          if (err instanceof HttpErrorResponse) {
            if (err.status === 0 || err.status === 429 || err.status >= 500) {
              if (err.status !== 429) this.isOnline.set(false);
              break;
            }
          }

          console.error(`Permanent error on action ${action.id}, dropping.`, err);
          this.setQueue(this.getQueue().filter(a => a.id !== action.id));
        }
      }
    } finally {
      this.isSyncing.set(false);
    }
  }

  private updateLocalState(updateFn: (labels: Label[]) => Label[]) {
    const current = this.getLocalLabels();
    const updated = updateFn(current);
    this.setLocalLabels(updated);
    this.labels.set(updated);
  }

  private getLocalLabels(): Label[] {
    const stored: string | null = localStorage.getItem('labels');
    if (stored) {
      return JSON.parse(stored);
    }

    this.setLocalLabels(DEFAULT_LABELS);
    return DEFAULT_LABELS;
  }

  private setLocalLabels(labels: Label[]) {
    localStorage.setItem('labels', JSON.stringify(labels));
  }

  private replaceLocalId(oldId: number, newId: number) {
    this.updateLocalState(labels =>
      labels.map(l => l.id === oldId ? {...l, id: newId} : l)
    );
  }

  private updateQueueIds(oldId: number, newId: number) {
    const queue = this.getQueue();
    queue.forEach(action => {
      if (action.labelId === oldId) action.labelId = newId;
    });
    this.setQueue(queue);
  }
}
