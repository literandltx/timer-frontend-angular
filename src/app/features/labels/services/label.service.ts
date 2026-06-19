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
  }

  async loadLabels() {
  }

  async save(request: CreateLabelRequest) {

  }

  async update(uuid: string, request: UpdateLabelRequest) {

  }

  async delete(uuid: string) {

  }

}
