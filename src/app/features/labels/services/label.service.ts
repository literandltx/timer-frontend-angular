import {Injectable, signal, inject, DestroyRef} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {firstValueFrom, switchMap, EMPTY} from 'rxjs';
import {HttpErrorResponse} from '@angular/common/http';

import {Label, CreateLabelRequest, UpdateLabelRequest} from '../models/label.model';
import {AppDB} from '../../../core/db/app.db';
import {LabelApiService} from './label-api.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model'
import {WebSocketCoreService} from '../../../core/netwrok/websocket.service'

@Injectable({providedIn: 'root'})
export class LabelService {

  private db = inject(AppDB);
  private health = inject(HealthCheckService);
  private labelApi = inject(LabelApiService);
  private wsCore = inject(WebSocketCoreService);
  private destroyRef = inject(DestroyRef);

  public labels = signal<Label[]>([]);

  constructor() {
    this.loadLabels();
    this.listenIncomingChanges();
  }

  async loadLabels() {
    try {
      const labels: Label[] = await this.db.labels.toArray();
      this.labels.set(labels);
    } catch (error) {
      console.error('Failed to load labels from DB', error);
    }
  }

  private listenIncomingChanges() {
    toObservable(this.health.isHealthy)
      .pipe(
        switchMap((isHealthy: boolean) => {
          if (isHealthy) {
            console.info('[LabelService] System healthy, watching labels WS...');
            return this.wsCore.watch<SyncMessage<Label>>('/user/queue/labels');
          } else {
            console.warn('[LabelService] System offline, suspending WS watch...');
            return EMPTY;
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: async (message: SyncMessage<Label>) => await this.processIncomingSyncMessage(message),
        error: (err: unknown) => console.error('[LabelService] WS stream error:', err)
      });
  }

  private async processIncomingSyncMessage(message: SyncMessage<Label>) {
    const {action, payload} = message;
    const id = payload.uuid;

    try {
      await this.db.transaction('rw', this.db.labels, async () => {
        const existingRecord = await this.db.labels.get(id);

        switch (action) {
          case SyncAction.CREATE:
          case SyncAction.UPDATE:
            if (existingRecord && this.isEqual(existingRecord, payload)) {
              console.log(`[LabelService] Ignoring WS update, local record is already up-to-date: ${id}`);
              return;
            }
            await this.db.labels.put(payload);
            break;

          case SyncAction.DELETE:
            if (!existingRecord) {
              return;
            }
            await this.db.labels.delete(id);
            break;

          default:
            console.warn(`[LabelService] Unhandled sync action: ${action}`);
            return;
        }
      });

      await this.loadLabels();
    } catch (error) {
      console.error(`[LabelService] Failed to process ${action} for label:`, error);
    }
  }

  async save(request: CreateLabelRequest) {
    if (this.health.isHealthy()) {
      try {
        const newLabel = await firstValueFrom(this.labelApi.save(request));
        await this.db.transaction('rw', this.db.labels, async () => {
          this.db.labels.put(newLabel);
        });
      } catch (error) {
        console.error('[LabelService] Failed to save label to API', error);
        return;
      }
    } else {
      // todo: add to offline sync queue
    }

    await this.loadLabels();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    if (this.health.isHealthy()) {
      try {
        const updatedLabel = await firstValueFrom(this.labelApi.update(uuid, request));
        await this.db.transaction('rw', this.db.labels, async () => {
          this.db.labels.put(updatedLabel);
        });
      } catch (error) {
        console.error(`[LabelService] Failed to update label ${uuid} in API`, error);
        return;
      }
    } else {
      // todo: add to offline sync queue
    }

    await this.loadLabels();
  }

  async delete(uuid: string) {
    if (this.health.isHealthy()) {
      try {
        await firstValueFrom(this.labelApi.delete(uuid));
        await this.db.transaction('rw', this.db.labels, async () => {
          this.db.labels.delete(uuid);
        });
      } catch (error) {
        console.error(`[LabelService] Failed to delete label ${uuid} in API`, error);
        return;
      }
    } else {
      // todo: add to offline sync queue
    }

    await this.loadLabels();
  }

  private isEqual(obj1: any, obj2: any): boolean {
    if (obj1 === obj2) return true;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 == null || obj2 == null) {
      return false;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
      if (obj1[key] !== obj2[key]) {
        return false;
      }
    }
    return true;
  }
}
