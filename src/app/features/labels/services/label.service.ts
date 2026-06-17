import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom, Subscription} from 'rxjs';
import {
  Label,
  CreateLabelRequest,
  UpdateLabelRequest
} from '../models/label.model';
import {WebSocketCoreService} from '../../../core/netwrok/websocket.service';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model';
import {AppDB} from '../../../core/db/app.db';
import {AuthService} from '../../../core/auth/auth.service';
import {LabelApiService} from './label-api.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';

@Injectable({providedIn: 'root'})
export class LabelService implements OnDestroy {
  private baseUrl = 'http://localhost:8080';
  private labelApiUrl = 'http://localhost:8080/api/v1/labels';

  private db: AppDB = inject(AppDB);
  private authService: AuthService = inject(AuthService);
  private labelsApi: LabelApiService = inject(LabelApiService);
  private webSocket: WebSocketCoreService = inject(WebSocketCoreService);
  private healthCheckService: HealthCheckService = inject(HealthCheckService);

  private isSyncing = false;
  private wsSubscription?: Subscription;

  public labels = signal<Label[]>([]);

  constructor() {
    this.loadLabels();
    this.initWebSocketConnection();
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
    this.webSocket.disconnect();
  }

  private initWebSocketConnection() {
    if (this.authService.isAuthenticated()) {
      const token = this.authService.getToken();
      if (!token) return;

      this.webSocket.connect(this.baseUrl, token);

      this.wsSubscription = this.webSocket.watch<SyncMessage<Label>>('/user/queue/labels').subscribe({
        next: (incomingMessage: SyncMessage<Label>) => this.handleIncomingSync(incomingMessage),
        error: (err) => console.error(err)
      });

      this.webSocket.onConnected$.subscribe(() => {
        this.processSyncQueue();
      });
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<Label>) {
    const action = incomingMessage.action;
    const payload = incomingMessage.payload;

    try {
      switch (action) {
        case SyncAction.CREATE:
        case SyncAction.UPDATE:
          await this.db.labels.put(payload);
          break;
        case SyncAction.DELETE:
          await this.db.labels.delete(payload.uuid);
          break;
        default:
          return;
      }
      await this.loadLabels();
    } catch (error) {
      console.error(error);
    }
  }

  async loadLabels() {
    try {
      const allLabels = await this.db.labels.toArray();
      this.labels.set(allLabels);
    } catch (error) {
      console.error(error);
    }
  }

  async save(request: CreateLabelRequest) {
    const uuid = crypto.randomUUID();
    const newLabel: Label = {...request, uuid, deleted: false};

    await this.db.transaction('rw', this.db.labels, this.db.syncQueue, async () => {
      await this.db.labels.add(newLabel);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'LABEL',
        action: 'CREATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadLabels();
    this.processSyncQueue();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    const existingLabel = await this.db.labels.get(uuid);

    if (!existingLabel) {
      console.warn(`[LabelService] Cannot update: Label ${uuid} not found locally.`);
      return;
    }

    const updatedLabel: Label = {
      ...existingLabel,
      ...request
    };

    await this.db.transaction('rw', this.db.labels, this.db.syncQueue, async () => {
      await this.db.labels.put(updatedLabel);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'LABEL',
        action: 'UPDATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadLabels();
    this.processSyncQueue();
  }

  async delete(uuid: string) {
    await this.db.transaction('rw', this.db.labels, this.db.syncQueue, async () => {
      await this.db.labels.delete(uuid);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'LABEL',
        action: 'DELETE',
        payload: {uuid},
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadLabels();
    this.processSyncQueue();
  }

  private async processSyncQueue() {
    if (!this.healthCheckService.isHealthy() || this.isSyncing) {
      return;
    }
    this.isSyncing = true;

    try {
      const queue = await this.db.syncQueue.orderBy('id').toArray();

      for (const item of queue) {
        try {
          if (item.action === 'CREATE') {
            await firstValueFrom(this.labelsApi.create(this.labelApiUrl, item.payload));
          } else if (item.action === 'UPDATE') {
            await firstValueFrom(this.labelsApi.update(this.labelApiUrl, item.entityId, item.payload));
          } else if (item.action === 'DELETE') {
            await firstValueFrom(this.labelsApi.delete(this.labelApiUrl, item.entityId));
          }
          await this.db.syncQueue.delete(item.id!);
        } catch (error: any) {
          const shouldBreak = await this.handleSyncError(item, error);
          if (shouldBreak) {
            break;
          }
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async handleSyncError(item: any, error: any): Promise<boolean> {
    if (error instanceof HttpErrorResponse) {
      const isRecoverable = error.status === 429 || error.status >= 500 || error.status === 0;

      if (isRecoverable) {
        await this.db.syncQueue.update(item.id!, {
          status: 'ERROR',
          retries: (item.retries || 0) + 1,
          lastError: `HTTP ${error.status}: ${error.message}`
        });
        return true;
      }
    }

    await this.db.syncQueue.delete(item.id!);
    return false;
  }
}
