import {Injectable, signal, inject, OnDestroy} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {firstValueFrom, Subscription} from 'rxjs';
import {
  TimerEntry,
  CreateTimerEntryRequest,
  UpdateTimerEntryRequest
} from '../models/timer-entry.model';
import {WebSocketCoreService} from '../../../core/netwrok/websocket.service';
import {SyncMessage, SyncAction} from '../../../core/netwrok/sync-message.model';
import {AppDB} from '../../../core/db/app.db';
import {AuthService} from '../../../core/auth/auth.service';
import {HealthCheckService} from '../../../core/netwrok/health.service';
import {LabelService} from '../../labels/services/label.service';

const DEFAULT_MINIMUM_TIMER_DURATION = 60;

@Injectable({providedIn: 'root'})
export class TimerEntryService implements OnDestroy {

  public allEntriesSignal = signal<TimerEntry[]>([]);
  public entries = signal<TimerEntry[]>([]);

  constructor() {
    this.loadEntries();
  }

  ngOnDestroy() {
  }

  private async pullServerChanges() {
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerEntry>) {
  }

  async loadEntries(page = 0, size = 10) {
  }

  get allLocalEntries() {
    return this.allEntriesSignal();
  }

  recordTimerFinish(durationSeconds: number, activeLabelUuid?: string, fallbackLabelUuid?: string) {
    const finalLabelUuid = activeLabelUuid || fallbackLabelUuid;

    if (!finalLabelUuid) return;

    const finalDuration = Math.max(durationSeconds, DEFAULT_MINIMUM_TIMER_DURATION);
    const startTime = Date.now() - (finalDuration * 1000);
    const now = new Date().toISOString();

    const request: CreateTimerEntryRequest = {
      uuid: crypto.randomUUID(),
      labelUuid: finalLabelUuid,
      durationSeconds: finalDuration,
      startTime: startTime,
      createdAt: now,
      updatedAt: now
    };

    this.save(request);
  }

  async save(request: CreateTimerEntryRequest) {
  }

  async update(uuid: string, request: UpdateTimerEntryRequest) {
  }

  async delete(uuid: string) {
  }

  private async processSyncQueue() {
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
