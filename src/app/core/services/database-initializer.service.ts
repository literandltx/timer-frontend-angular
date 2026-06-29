import {Injectable, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {AppDB, EntityType, SyncActionType} from '../db/app.db';
import {AuthService} from '../auth/auth.service';
import {LabelApiService} from '../../features/labels/services/label-api.service';
import {TimerOptionApiService} from '../../features/timers/services/timer-option-api.service';
import {TimerSettingApiService} from '../../features/timers/services/timer-setting-api.service';
import {DEFAULT_LABELS} from '../../features/labels/models/label.constants';
import {DEFAULT_TIMER_OPTIONS} from '../../features/timers/models/timer-option.constants';
import {CreateLabelRequest, Label} from '../../features/labels/models/label.model';
import {CreateTimerOptionRequest, TimerOption} from '../../features/timers/models/timer-option.model';
import {TimerSettingRequest, TimerSetting} from '../../features/timers/models/timer-setting.model';

@Injectable({providedIn: 'root'})
export class DatabaseInitializer {
  private db = inject(AppDB);
  private auth = inject(AuthService);
  private labelApi = inject(LabelApiService);
  private optionsApi = inject(TimerOptionApiService);
  private settingsApi = inject(TimerSettingApiService);

  private readonly SEEDED_KEY = 'app_db_seeded_v1';

  async seedInitialData(): Promise<void> {
    if (localStorage.getItem(this.SEEDED_KEY) === 'true') {
      console.log('[Seeder] Database already seeded. Skipping initialization.');
      return;
    }

    try {
      const isAuthed = this.auth.isAuthenticatedSignal();
      const now = new Date().toISOString();

      if (isAuthed) {
        try {
          const EPOCH = new Date(0).toISOString();
          const existingOptions = await firstValueFrom(this.optionsApi.pullUpdates(EPOCH));
          if (existingOptions && existingOptions.length > 0) {
            console.log('[Seeder] Existing user data found. Skipping default seeds.');
            localStorage.setItem(this.SEEDED_KEY, 'true');
            return;
          }
        } catch (e) {
          console.warn('[Seeder] Could not verify backend data. Proceeding to seed offline.', e);
        }
      }

      console.info('[Seeder] Starting strict sequential data seeding...');

      for (const defaultLabel of DEFAULT_LABELS) {
        const labelUuid = defaultLabel.uuid || crypto.randomUUID();
        const req: CreateLabelRequest = { ...defaultLabel, uuid: labelUuid, createdAt: now, updatedAt: now } as CreateLabelRequest;

        await this.db.labels.put({ ...req, deleted: false } as Label);
        await this.pushOrQueue('LABEL', 'CREATE', req, isAuthed, () => firstValueFrom(this.labelApi.save(req)));
      }

      const defaultOptionUuid = DEFAULT_TIMER_OPTIONS[0].uuid as string;
      for (const defaultOption of DEFAULT_TIMER_OPTIONS) {
        const optionUuid = defaultOption.uuid || crypto.randomUUID();
        const req: CreateTimerOptionRequest = {
          ...defaultOption,
          uuid: optionUuid,
          createdAt: now,
          updatedAt: now
        } as CreateTimerOptionRequest;

        await this.db.timerOptions.put({
          ...req,
          deleted: false
        } as TimerOption);
        await this.pushOrQueue('TIMER_OPTION', 'CREATE', req, isAuthed, () => firstValueFrom(this.optionsApi.save(req)));
      }

      const initialSettingId = crypto.randomUUID();
      const settingReq: TimerSettingRequest = {
        uuid: initialSettingId,
        timerOptionUuid: defaultOptionUuid,
        createdAt: now,
        updatedAt: now
      };

      await this.db.timerSettings.put({
        ...settingReq,
        deleted: false
      } as TimerSetting);
      await this.pushOrQueue('TIMER_SETTING', 'UPDATE', settingReq, isAuthed, () => firstValueFrom(this.settingsApi.save(settingReq)));

      localStorage.setItem(this.SEEDED_KEY, 'true');
      console.info('[Seeder] Initialization complete.');
    } catch (error) {
      console.error('[Seeder] CRITICAL: Failed to seed default data', error);
    }
  }

  private async pushOrQueue(entityType: EntityType, action: SyncActionType, payload: unknown, isAuthed: boolean, apiCall: () => Promise<unknown>) {
    if (isAuthed) {
      try {
        await apiCall();
      } catch (error) {
        console.warn(`[Seeder] Backend save failed for ${entityType}, queuing offline.`, error);
        await this.queueAction(entityType, action, payload);
      }
    } else {
      await this.queueAction(entityType, action, payload);
    }
  }

  private async queueAction(entityType: EntityType, action: SyncActionType, payload: any) {
    await this.db.syncQueue.add({
      entityId: payload.uuid,
      entityType: entityType,
      action: action,
      payload: payload,
      timestamp: Date.now(),
      status: 'PENDING'
    });
  }

}
