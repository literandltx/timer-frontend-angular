import {Injectable, signal, inject, DestroyRef} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {
  TimerEntry,
  CreateTimerEntryRequest,
  UpdateTimerEntryRequest
} from '../models/timer-entry.model';

import {AppDB} from '../../../core/db/app.db';
import {TimerEntryApiService} from './timer-entry-api.service';
import {SyncEngineService} from '../../../core/services/sync-engine.service';
import {EntitySyncOrchestrator} from '../../../core/netwrok/entity-sync-orchestrator.service';

const DEFAULT_MINIMUM_TIMER_DURATION = 60;

@Injectable({providedIn: 'root'})
export class TimerEntryService {
  private db = inject(AppDB);
  private api = inject(TimerEntryApiService);
  private syncEngine = inject(SyncEngineService);
  private syncOrchestrator = inject(EntitySyncOrchestrator);
  private destroyRef = inject(DestroyRef);

  private readonly ENTITY_TYPE = 'TIMER_ENTRY';
  private readonly WS_TOPIC = '/user/queue/timer-entries';

  public allEntriesSignal = signal<TimerEntry[]>([]);
  public entries = signal<TimerEntry[]>([]);

  constructor() {
    this.syncOrchestrator.setupSync<TimerEntry, CreateTimerEntryRequest, UpdateTimerEntryRequest>(
      this.ENTITY_TYPE,
      this.WS_TOPIC,
      this.api,
      this.db.timerEntries,
      this.destroyRef,
      () => this.loadEntries()
    );

    this.loadEntries();
  }

  async loadEntries(page = 0, size = 10) {
    try {
      const rawEntries = await this.db.timerEntries
        .filter(entry => !entry.deleted)
        .reverse()
        .sortBy('startTime');

      const populatedEntries = await Promise.all(
        rawEntries.map(async (entry) => {
          if (entry.labelId) {
            const label = await this.db.labels.get(entry.labelId);
            if (label) {
              entry.label = {name: label.name, color: label.color};
            }
          }
          return entry;
        })
      );

      this.allEntriesSignal.set(populatedEntries);
      const startIndex = page * size;
      this.entries.set(populatedEntries.slice(startIndex, startIndex + size));
    } catch (error) {
      console.error('[TimerEntryService] Failed to load entries:', error);
    }
  }

  get allLocalEntries() {
    return this.allEntriesSignal();
  }

  recordTimerFinish(durationSeconds: number, activelabelId?: string, fallbacklabelId?: string) {
    const finallabelId = activelabelId || fallbacklabelId;

    if (!finallabelId) return;

    const finalDuration = Math.max(durationSeconds, DEFAULT_MINIMUM_TIMER_DURATION);
    const startTime = Date.now() - (finalDuration * 1000);
    const now = new Date().toISOString();

    const request: CreateTimerEntryRequest = {
      uuid: crypto.randomUUID(),
      labelId: finallabelId,
      durationSeconds: finalDuration,
      startTime: startTime,
      createdAt: now,
      updatedAt: now
    };

    this.save(request);
  }

  async save(request: CreateTimerEntryRequest) {
    const uuid = request.uuid || crypto.randomUUID();
    const optimisticEntry = {...request, uuid} as unknown as TimerEntry;

    await this.syncEngine.executeMutation(
      'CREATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.api.save(request)),
      async () => {
        await this.db.timerEntries.put(optimisticEntry);
      },
      this.db.timerEntries
    );
    await this.loadEntries();
  }

  async update(uuid: string, request: UpdateTimerEntryRequest) {
    const existingEntry = await this.db.timerEntries.get(uuid);
    const optimisticEntry = {...existingEntry, ...request} as TimerEntry;

    await this.syncEngine.executeMutation(
      'UPDATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.api.update(uuid, request)),
      async () => {
        await this.db.timerEntries.put(optimisticEntry);
      },
      this.db.timerEntries
    );
    await this.loadEntries();
  }

  async delete(uuid: string) {
    await this.syncEngine.executeMutation(
      'DELETE',
      this.ENTITY_TYPE,
      uuid,
      null,
      () => firstValueFrom(this.api.delete(uuid)),
      async () => {
        await this.db.timerEntries.delete(uuid);
      },
      this.db.timerEntries
    );
    await this.loadEntries();
  }


  async exportCSV() {
  }

  private exportServer() {
  }

  private async exportLocal() {
  }

  async importCSV(file: File): Promise<void> {
    return new Promise<void>(() => {
    });
  }

  private async importServer(file: File): Promise<void> {
    return new Promise<void>(() => {
    });
  }

  private async importLocal(file: File): Promise<void> {
    return new Promise<void>(() => {
    });
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

}
