import {Injectable, signal, inject} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {
  Label,
  CreateLabelRequest,
  UpdateLabelRequest,
  LabelSyncAction
} from '../models/label.model';
import {DEFAULT_LABELS} from '../models/label.constants';
import {BaseOfflineSyncService} from '../../../core/services/base-offline-sync.service';
import {WebSocketCoreService} from '../../../core/netwrok/websocket.service';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model';
import {AppDB} from '../../../core/db/app.db';
import {AuthService} from '../../../core/auth/auth.service';
import {LabelApiService} from './label-api.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';

@Injectable({providedIn: 'root'})
export class LabelService {
  private baseUrl = 'http://localhost:8080';
  private labelApiUrl = 'http://localhost:8080/api/v1/labels';
  protected queueKey = 'label_sync_queue';

  private db: AppDB = inject(AppDB);
  private authService: AuthService = inject(AuthService);
  private labelsApi: LabelApiService = inject(LabelApiService)
  private webSocket: WebSocketCoreService = inject(WebSocketCoreService);
  private healthCheckService: HealthCheckService = inject(HealthCheckService);

  labels = signal<Label[]>([]);

  constructor() {
    this.loadLabels()
    this.initWebSocketConnection();
  }

  private initWebSocketConnection() {
    if (this.authService.isAuthenticated()) {
      const token: string | null = this.authService.getToken();

      if (!token) {
        console.log('[LabelService] Auth token is null');
        return;
      }

      this.webSocket.connect(this.baseUrl, token);
      this.webSocket.watch<SyncMessage<Label>>('/user/queue/labels').subscribe({
        next: (incomingMessage: SyncMessage<Label>) => {
          console.log('[LabelService] Received WebSocket update:', incomingMessage);
          this.handleIncomingSync(incomingMessage);
        },
        error: (err) => console.error('[LabelService] WebSocket watch error:', err)
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
          console.log(`Label ${action.toLowerCase()}d:`, payload);
          await this.db.labels.put(payload);
          break;
        case SyncAction.DELETE:
          console.log('Label deleted:', payload);
          await this.db.labels.delete(payload.uuid);
          break;
        default:
          console.warn(`[LabelService] Unknown sync action: ${action}`);
          return;
      }
      await this.loadLabels();
    } catch (error) {
      console.error('[LabelService] Error applying incoming sync to local DB:', error);
    }
  }

  async loadLabels() {
    try {
      const allLabels = await this.db.labels.toArray();
      this.labels.set(allLabels);
    } catch (error) {
      console.error('[LabelService] Error loading labels from DB:', error);
    }
  }

  async save(request: CreateLabelRequest) {
    const uuid = crypto.randomUUID();
    const newLabel: Label = {
      ...request,
      deleted: false
    };

    await this.db.labels.add(newLabel);
    await this.loadLabels();

    if (this.healthCheckService.isHealthy()) {
      await firstValueFrom(
        this.labelsApi.create(this.labelApiUrl, request)
      );
      console.log(`[LabelService] Successfully synced new label ${uuid} to server.`);
    } else {
      console.warn('[LabelService] Server unreachable. Queuing CREATE sync action.');
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'LABEL',
        action: 'CREATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING'
      });
    }
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

    await this.db.labels.put(updatedLabel);
    await this.loadLabels();

    if (this.healthCheckService.isHealthy()) {
      await firstValueFrom(
        this.labelsApi.update(this.labelApiUrl, uuid, request)
      );
      console.log(`[LabelService] Successfully synced updated label ${uuid} to server.`);
    } else {
      console.warn(`[LabelService] Server unreachable. Queuing UPDATE sync action for label ${uuid}.`);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'LABEL',
        action: 'UPDATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING'
      });
    }
  }

  async delete(uuid: string) {
    await this.db.labels.delete(uuid);
    await this.loadLabels();

    if (this.healthCheckService.isHealthy()) {
      await firstValueFrom(
        this.labelsApi.delete(this.labelApiUrl, uuid)
      );
      console.log(`[LabelService] Successfully synced deletion of label ${uuid} to server.`);
    } else {
      console.warn(`[LabelService] Server unreachable. Queuing DELETE sync action for label ${uuid}.`);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'LABEL',
        action: 'DELETE',
        payload: {uuid},
        timestamp: Date.now(),
        status: 'PENDING'
      });
    }
  }
}
