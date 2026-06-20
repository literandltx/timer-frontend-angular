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
  private labelApi = inject(LabelApiService);

  public labels = signal<Label[]>([]);

  constructor() {
    this.loadLabels();
  }

  async loadLabels() {
    try {
      const labels: Label[] = await this.db.labels.toArray();
      this.labels.set(labels);
    } catch (error) {
      console.error('Failed to load labels from DB', error);
    }
  }

  async save(request: CreateLabelRequest) {
    if (this.health.isHealthy()) {
      const newLabel = await firstValueFrom(this.labelApi.save(request));
      await this.db.transaction('rw', this.db.labels, async () => {
        this.db.labels.add(newLabel);
      });
    } else {
      // todo: add in queue
    }

    await this.loadLabels();
  }

  async update(uuid: string, request: UpdateLabelRequest) {
    if (this.health.isHealthy()) {
      const updatedLabel = await firstValueFrom(this.labelApi.update(uuid, request));
      await this.db.transaction('rw', this.db.labels, async () => {
        this.db.labels.update(uuid, updatedLabel);
      });
    } else {
      // todo: add in queue
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
      // todo: add in queue
    }

    await this.loadLabels();
  }

}
