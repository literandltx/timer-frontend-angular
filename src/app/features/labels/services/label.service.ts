import {Injectable, signal, inject} from '@angular/core';
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
        takeUntilDestroyed()
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
            if (existingRecord && JSON.stringify(existingRecord) === JSON.stringify(payload)) {
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
      const newLabel = await firstValueFrom(this.labelApi.save(request));
      await this.db.transaction('rw', this.db.labels, async () => {
        this.db.labels.put(newLabel);
      });
    } else {
      // todo: add to offline sync queue
    }

    await this.loadLabels();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    if (this.health.isHealthy()) {
      const updatedLabel = await firstValueFrom(this.labelApi.update(uuid, request));
      await this.db.transaction('rw', this.db.labels, async () => {
        this.db.labels.put(updatedLabel);
      });
    } else {
      // todo: add to offline sync queue
    }

    await this.loadLabels();
  }

  async delete(uuid: string) {
    if (this.health.isHealthy()) {
      await firstValueFrom(this.labelApi.delete(uuid));
      await this.db.transaction('rw', this.db.labels, async () => {
        this.db.labels.delete(uuid);
      });
    } else {
      // todo: add to offline sync queue
    }

    await this.loadLabels();
  }

}
