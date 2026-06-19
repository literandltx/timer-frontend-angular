import {Injectable, signal, inject} from '@angular/core';
import {HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom} from 'rxjs';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {Label, CreateLabelRequest, UpdateLabelRequest} from '../models/label.model';
import {AppDB} from '../../../core/db/app.db';
import {LabelApiService} from './label-api.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';

@Injectable({providedIn: 'root'})
export class LabelService {

  private db = inject(AppDB);
  private health = inject(HealthCheckService);
  private api = inject(LabelApiService);

  public labels = signal<Label[]>([]);
  private isSyncing = false;

  constructor() {
    toObservable(this.health.isHealthy)
      .pipe(takeUntilDestroyed())
      .subscribe((isHealthy) => {
        if (isHealthy) {
          this.processSyncQueue();
        }
      });
  }

  async loadLabels() {
    const allLabels = await this.db.labels.filter(label => !label.deleted).toArray();
    this.labels.set(allLabels);
  }

  async save(request: CreateLabelRequest) {
    const now = new Date().toISOString();
    const newLabel: Label = {...request, createdAt: now, updatedAt: now, deleted: false};

    await this.db.transaction('rw', this.db.labels, this.db.syncQueue, async () => {
      await this.db.labels.add(newLabel);
      await this.queueSyncAction(request.uuid, 'CREATE', request);
    });

    await this.loadLabels();
    this.processSyncQueue();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    const now = new Date().toISOString();

    await this.db.transaction('rw', this.db.labels, this.db.syncQueue, async () => {
      await this.db.labels.update(uuid, {...request, updatedAt: now});
      await this.queueSyncAction(uuid, 'UPDATE', request);
    });

    await this.loadLabels();
    this.processSyncQueue();
  }

  async delete(uuid: string) {
    const now = new Date().toISOString();

    await this.db.transaction('rw', this.db.labels, this.db.syncQueue, async () => {
      await this.db.labels.update(uuid, {deleted: true, updatedAt: now});
      await this.queueSyncAction(uuid, 'DELETE', null);
    });

    await this.loadLabels();
    this.processSyncQueue();
  }

  private async queueSyncAction(entityId: string, action: 'CREATE' | 'UPDATE' | 'DELETE', payload: any) {
    await this.db.syncQueue.add({
      entityId,
      entityType: 'LABEL' as any,
      action,
      payload,
      timestamp: Date.now(),
      status: 'PENDING',
      retries: 0
    });
  }

  private async processSyncQueue() {
    if (!this.health.isHealthy() || this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      const queue = await this.db.syncQueue.orderBy('id').toArray();

      for (const item of queue) {
        const canContinue = await this.processSyncItem(item);
        if (!canContinue) break;
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async processSyncItem(item: any): Promise<boolean> {
    try {
      switch (item.action) {
        case 'CREATE':
          await firstValueFrom(this.api.create(item.payload));
          break;
        case 'UPDATE':
          await firstValueFrom(this.api.update(item.entityId, item.payload));
          break;
        case 'DELETE':
          await firstValueFrom(this.api.delete(item.entityId));
          break;
      }
      await this.db.syncQueue.delete(item.id!);
      return true;
    } catch (error) {
      return this.handleSyncError(item, error);
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
        return false;
      }
    }

    await this.db.syncQueue.delete(item.id!);
    return true;
  }
}
