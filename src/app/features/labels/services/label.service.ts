import {Injectable, signal, inject} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {Label, CreateLabelRequest, UpdateLabelRequest, SyncAction} from '../models/label.model';
import {DEFAULT_LABELS} from '../models/label.constants';
import {BaseOfflineSyncService} from '../../../core/services/base-offline-sync.service';
import {WebSocketCoreService} from '../../../core/netwrok/websocket.service';

@Injectable({providedIn: 'root'})
export class LabelService extends BaseOfflineSyncService<SyncAction> {
  protected pingUrl = 'http://localhost:8080/api/v1/labels';
  protected queueKey = 'label_sync_queue';

  private webSocket = inject(WebSocketCoreService);

  labels = signal<Label[]>([]);

  constructor() {
    super();
    this.initWebSocketConnection();
  }

  private initWebSocketConnection() {
    const baseUrl = 'http://localhost:8080';

    if (this.authService.isAuthenticated()) {
      const token: string | null = this.authService.getToken();

      if (!token) {
        console.log('[LabelService] Auth token is null');
        return;
      }

      this.webSocket.connect(baseUrl, token);
      this.webSocket.watch('/user/queue/labels').subscribe({
        next: (message) => {
          try {
            const incomingChange = JSON.parse(message.body);
          } catch (e) {
            console.error('[LabelService] Failed to parse incoming WebSocket message:', e);
          }
        }
      });
    }
  }

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

  async save(request: CreateLabelRequest) {
    const newLabel: Label = {...request, userId: 0, deleted: false};

    this.updateLocalState(labels => [...labels, newLabel]);
    this.enqueueAction({type: 'CREATE', payload: newLabel, labelUuid: request.uuid});
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    this.updateLocalState(labels =>
      labels.map(l => l.uuid === uuid ? {...l, ...request} : l)
    );

    const queue = this.getQueue();
    const pendingCreate = queue.find(a => a.type === 'CREATE' && a.labelUuid === uuid);

    if (pendingCreate) {
      pendingCreate.payload = {...pendingCreate.payload, ...request};
      this.setQueue(queue);
    } else {
      this.enqueueAction({type: 'UPDATE', labelUuid: uuid, payload: request});
    }
  }

  async delete(uuid: string) {
    this.updateLocalState(labels => labels.filter(l => l.uuid !== uuid));

    const queue = this.getQueue();
    const pendingCreate = queue.find(a => a.type === 'CREATE' && a.labelUuid === uuid);

    if (pendingCreate) {
      this.setQueue(queue.filter(a => a.labelUuid !== uuid));
    } else {
      this.enqueueAction({type: 'DELETE', labelUuid: uuid});
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
            await firstValueFrom(this.http.post<Label>(this.pingUrl, action.payload));
          } else if (action.type === 'UPDATE') {
            await firstValueFrom(this.http.put<Label>(`${this.pingUrl}/${action.labelUuid}`, action.payload));
          } else if (action.type === 'DELETE') {
            await firstValueFrom(this.http.delete<void>(`${this.pingUrl}/${action.labelUuid}`));
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
}
