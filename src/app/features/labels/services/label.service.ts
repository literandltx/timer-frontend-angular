import {Injectable, signal, inject, DestroyRef} from '@angular/core';
import {firstValueFrom} from 'rxjs';

import {Label, CreateLabelRequest, UpdateLabelRequest} from '../models/label.model';
import {AppDB} from '../../../core/db/app.db';
import {LabelApiService} from './label-api.service';
import {SyncEngineService} from '../../../core/services/sync-engine.service';
import {EntitySyncOrchestrator} from '../../../core/netwrok/entity-sync-orchestrator.service';

@Injectable({providedIn: 'root'})
export class LabelService {
  private db = inject(AppDB);
  private labelApi = inject(LabelApiService);
  private syncEngine = inject(SyncEngineService);
  private syncOrchestrator = inject(EntitySyncOrchestrator);
  private destroyRef = inject(DestroyRef);

  private readonly ENTITY_TYPE = 'LABEL';
  private readonly WS_LABEL_TOPIC = '/user/queue/labels';

  public labels = signal<Label[]>([]);

  constructor() {
    this.loadLabels();
    this.syncOrchestrator.setupSync<Label, CreateLabelRequest, UpdateLabelRequest>(
      this.ENTITY_TYPE,
      this.WS_LABEL_TOPIC,
      this.labelApi,
      this.db.labels,
      this.destroyRef,
      () => this.loadLabels()
    );
  }

  async loadLabels() {
    try {
      this.labels.set(await this.db.labels.toArray());
    } catch (error) {
      console.error('[LabelService] Failed to load labels:', error);
    }
  }

  async save(request: CreateLabelRequest) {
    const uuid = request.uuid || crypto.randomUUID();
    const optimisticLabel = {...request, uuid} as unknown as Label;

    await this.syncEngine.executeMutation(
      'CREATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.labelApi.save(request)),
      async () => {
        await this.db.labels.put(optimisticLabel);
      },
      this.db.labels
    );
    await this.loadLabels();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    const existingLabel = await this.db.labels.get(uuid);
    const optimisticLabel = {...existingLabel, ...request} as Label;

    await this.syncEngine.executeMutation(
      'UPDATE',
      this.ENTITY_TYPE,
      uuid,
      request,
      () => firstValueFrom(this.labelApi.update(uuid, request)),
      async () => {
        await this.db.labels.put(optimisticLabel);
      },
      this.db.labels
    );
    await this.loadLabels();
  }

  async delete(uuid: string) {
    await this.syncEngine.executeMutation(
      'DELETE',
      this.ENTITY_TYPE,
      uuid,
      null,
      () => firstValueFrom(this.labelApi.delete(uuid)),
      async () => {
        await this.db.labels.delete(uuid);
      },
      this.db.labels
    );
    await this.loadLabels();
  }

}
