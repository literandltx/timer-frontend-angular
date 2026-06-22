import {Injectable, signal, inject, DestroyRef} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from '../models/timer-option.model';
import {DEFAULT_TIMER_OPTIONS} from '../models/timer-option.constants';

import {AppDB} from '../../../core/db/app.db';
import {TimerOptionApiService} from './timer-option-api.service';
import {SyncEngineService} from '../../../core/services/sync-engine.service';
import {EntitySyncOrchestrator} from '../../../core/netwrok/entity-sync-orchestrator.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';
import {AuthService} from '../../../core/auth/auth.service';
import {TimerSettingsService} from './timer-settings.service';

@Injectable({providedIn: 'root'})
export class TimerOptionsService {
  private db = inject(AppDB);
  private api = inject(TimerOptionApiService);
  private syncEngine = inject(SyncEngineService);
  private syncOrchestrator = inject(EntitySyncOrchestrator);
  private destroyRef = inject(DestroyRef);
  private health = inject(HealthCheckService);
  private auth = inject(AuthService);
  private timerSettings = inject(TimerSettingsService);

  private readonly ENTITY_TYPE = 'TIMER_OPTION';
  private readonly WS_TOPIC = '/user/queue/timer-options';
  private readonly LOCAL_STORAGE_KEY = 'app_timer_options_seeded_v1';

  public options = signal<TimerOption[]>([]);

  constructor() {
    this.syncOrchestrator.setupSync<TimerOption, CreateTimerOptionRequest, UpdateTimerOptionRequest>(
      this.ENTITY_TYPE,
      this.WS_TOPIC,
      this.api,
      this.db.timerOptions,
      this.destroyRef,
      () => this.loadOptions()
    );
    this.initializeData();
  }

  private async initializeData() {
    await this.seedDefaultOptions();
    await this.loadOptions();
  }

  async loadOptions() {
    try {
      const rawOptions = await this.db.timerOptions.toArray();
      const activeOptions = rawOptions.filter(o => !o.deleted);

      const uniqueMap = new Map<number, TimerOption>();
      const duplicateUuids: string[] = [];

      for (const opt of activeOptions) {
        if (uniqueMap.has(opt.value)) {
          const existing = uniqueMap.get(opt.value)!;
          if (new Date(opt.createdAt) < new Date(existing.createdAt)) {
            duplicateUuids.push(existing.uuid);
            uniqueMap.set(opt.value, opt);
          } else {
            duplicateUuids.push(opt.uuid);
          }
        } else {
          uniqueMap.set(opt.value, opt);
        }
      }

      if (duplicateUuids.length > 0) {
        console.info(`[TimerOptionsService] Pruning ${duplicateUuids.length} sync duplicates.`);
        await this.db.timerOptions.bulkDelete(duplicateUuids);
      }

      const finalOptions = Array.from(uniqueMap.values()).sort((a, b) => a.value - b.value);
      this.options.set(finalOptions);

    } catch (error) {
      console.error('[TimerOptionsService] Failed to load options:', error);
    }
  }

  async save(request: CreateTimerOptionRequest) {
    const existing = await this.db.timerOptions.toArray();
    if (existing.some(opt => opt.value === request.value && !opt.deleted)) {
      console.warn(`[TimerOptionsService] Option with value ${request.value} already exists. Skipping.`);
      return;
    }

    const uuid = request.uuid || crypto.randomUUID();
    const optimisticOption = {...request, uuid} as unknown as TimerOption;

    await this.syncEngine.executeMutation(
      'CREATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.api.save(request)),
      async () => {
        await this.db.timerOptions.put(optimisticOption);
      },
      this.db.timerOptions
    );
    await this.loadOptions();
  }

  async update(uuid: string, request: UpdateTimerOptionRequest) {
    const existingList = await this.db.timerOptions.toArray();
    if (existingList.some(opt => opt.value === request.value && opt.uuid !== uuid && !opt.deleted)) {
      console.warn(`[TimerOptionsService] Cannot update. Value ${request.value} already in use.`);
      return;
    }

    const existingOption = await this.db.timerOptions.get(uuid);
    const optimisticOption = {...existingOption, ...request} as TimerOption;

    await this.syncEngine.executeMutation(
      'UPDATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.api.update(uuid, request)),
      async () => {
        await this.db.timerOptions.put(optimisticOption);
      },
      this.db.timerOptions
    );
    await this.loadOptions();
  }

  async delete(uuid: string) {
    await this.syncEngine.executeMutation(
      'DELETE',
      this.ENTITY_TYPE,
      uuid,
      null,
      () => firstValueFrom(this.api.delete(uuid)),
      async () => {
        await this.db.timerOptions.delete(uuid);
      },
      this.db.timerOptions
    );
    await this.loadOptions();
  }

  private async seedDefaultOptions() {
    if (localStorage.getItem(this.LOCAL_STORAGE_KEY) === 'true') {
      return;
    }

    try {
      const localCount = await this.db.timerOptions.count();

      if (localCount === 0) {
        const isAuthed = this.auth.isAuthenticatedSignal();

        if (isAuthed) {
          try {
            const EPOCH_DATE = new Date(0).toISOString();
            const serverOptions = await firstValueFrom(this.api.pullUpdates(EPOCH_DATE));

            if (serverOptions && serverOptions.length > 0) {
              console.log('[TimerOptionsService] Existing user history found. Skipping defaults.');
              localStorage.setItem(this.LOCAL_STORAGE_KEY, 'true');
              return;
            }
          } catch (apiError) {
            console.warn('[TimerOptionsService] Server unreachable. Aborting seed.', apiError);
            return;
          }
        }

        console.log('[TimerOptionsService] Safe to seed default timer options.');

        const now = new Date().toISOString();
        let firstOptionUuid: string | null = null;

        for (const defaultOption of DEFAULT_TIMER_OPTIONS) {
          const optionUuid = defaultOption.uuid || crypto.randomUUID();

          const request: CreateTimerOptionRequest = {
            ...defaultOption,
            uuid: optionUuid,
            createdAt: now,
            updatedAt: now,
          } as CreateTimerOptionRequest;

          if (!firstOptionUuid) {
            firstOptionUuid = optionUuid;
          }

          await this.save(request);
        }

        if (firstOptionUuid) {
          console.log('[TimerOptionsService] Initializing default timer setting.');
          await this.timerSettings.setActiveOption(firstOptionUuid);
        }
      }

      localStorage.setItem(this.LOCAL_STORAGE_KEY, 'true');
    } catch (error) {
      console.error('[TimerOptionsService] Failed to seed defaults:', error);
    }
  }
}
