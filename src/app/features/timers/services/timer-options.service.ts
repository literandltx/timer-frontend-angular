import {Injectable, signal, inject, DestroyRef} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {
  TimerOption,
  CreateTimerOptionRequest,
  UpdateTimerOptionRequest
} from '../models/timer-option.model';
import {AppDB} from '../../../core/db/app.db';
import {TimerOptionApiService} from './timer-option-api.service';
import {SyncEngineService} from '../../../core/services/sync-engine.service';
import {EntitySyncOrchestrator} from '../../../core/netwrok/entity-sync-orchestrator.service';
import {AuthService} from '../../../core/auth/auth.service';

@Injectable({providedIn: 'root'})
export class TimerOptionsService {
  private db = inject(AppDB);
  private api = inject(TimerOptionApiService);
  private syncEngine = inject(SyncEngineService);
  private syncOrchestrator = inject(EntitySyncOrchestrator);
  private destroyRef = inject(DestroyRef);
  private auth = inject(AuthService);

  private readonly ENTITY_TYPE = 'TIMER_OPTION';
  private readonly WS_TOPIC = '/user/queue/timer-options';

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

    this.loadOptions();
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
        await this.db.timerOptions.bulkDelete(duplicateUuids);
      }

      const finalOptions = Array.from(uniqueMap.values()).sort((a, b) => a.value - b.value);
      this.options.set(finalOptions);
    } catch (error) {
      console.error('[TimerOptionsService] Failed to load options:', error);
    }
  }

  async save(request: CreateTimerOptionRequest) {
    const uuid = request.uuid || crypto.randomUUID();
    const optimisticOption = {...request, uuid} as unknown as TimerOption;

    await this.syncEngine.executeMutation(
      'CREATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => this.auth.isAuthenticatedSignal()
        ? firstValueFrom(this.api.save(request))
        : Promise.reject(new Error('Unauthenticated. Routing to offline queue.')),
      async () => {
        await this.db.timerOptions.put(optimisticOption);
      },
      this.db.timerOptions
    );
    await this.loadOptions();
  }

  async update(uuid: string, request: UpdateTimerOptionRequest) {
    const existingOption = await this.db.timerOptions.get(uuid);
    const optimisticOption = {...existingOption, ...request} as TimerOption;

    await this.syncEngine.executeMutation(
      'UPDATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => this.auth.isAuthenticatedSignal()
        ? firstValueFrom(this.api.update(uuid, request))
        : Promise.reject(new Error('Unauthenticated. Routing to offline queue.')),
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
      () => this.auth.isAuthenticatedSignal()
        ? firstValueFrom(this.api.delete(uuid))
        : Promise.reject(new Error('Unauthenticated. Routing to offline queue.')),
      async () => {
        await this.db.timerOptions.delete(uuid);
      },
      this.db.timerOptions
    );
    await this.loadOptions();
  }

}
