import { Injectable, signal, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, Subscription } from 'rxjs';
import { TimerEntry, CreateTimerEntryRequest, UpdateTimerEntryRequest } from '../models/timer-entry.model';
import { WebSocketCoreService } from '../../../core/netwrok/websocket.service';
import { SyncMessage, SyncAction } from '../../../core/netwrok/sync-message.model';
import { AppDB } from '../../../core/db/app.db';
import { AuthService } from '../../../core/auth/auth.service';
import { HealthCheckService } from '../../../core/netwrok/health.service';
import { LabelService } from '../../labels/services/label.service';
import { TimerEntryApiService } from './timer-entry-api.service';

const DEFAULT_MINIMUM_TIMER_DURATION = 60;

@Injectable({ providedIn: 'root' })
export class TimerEntryService implements OnDestroy {
  private baseUrl = 'http://localhost:8080';
  private pingUrl = 'http://localhost:8080/api/v1/timer-entries';
  private lastSyncKey = 'last_timer_entry_sync_time';

  private db: AppDB = inject(AppDB);
  private http: HttpClient = inject(HttpClient);
  private authService: AuthService = inject(AuthService);
  private entryApi: TimerEntryApiService = inject(TimerEntryApiService);
  private webSocket: WebSocketCoreService = inject(WebSocketCoreService);
  private healthCheckService: HealthCheckService = inject(HealthCheckService);
  private labelService = inject(LabelService);

  private isSyncing = false;
  private wsSubscription?: Subscription;

  public allEntriesSignal = signal<TimerEntry[]>([]);
  public entries = signal<TimerEntry[]>([]);

  constructor() {
    this.loadEntries();
    this.initWebSocketConnection();
  }

  ngOnDestroy() {
    this.wsSubscription?.unsubscribe();
  }

  get allLocalEntries() {
    return this.allEntriesSignal();
  }

  private initWebSocketConnection() {
    if (this.authService.isAuthenticated()) {
      const token = this.authService.getToken();
      if (!token) return;

      this.webSocket.connect(this.baseUrl, token);

      this.wsSubscription = this.webSocket.watch<SyncMessage<TimerEntry>>('/user/queue/timer-entries').subscribe({
        next: (incomingMessage) => this.handleIncomingSync(incomingMessage),
        error: (err) => console.error(err)
      });

      this.webSocket.onConnected$.subscribe(async () => {
        await this.pullServerChanges();
        await this.processSyncQueue();
      });
    }
  }

  private async pullServerChanges() {
    try {
      const lastSyncTime = localStorage.getItem(this.lastSyncKey);

      const updatedEntries = await firstValueFrom(
        this.entryApi.pullUpdates(this.pingUrl, lastSyncTime)
      );

      if (updatedEntries && updatedEntries.length > 0) {
        await this.db.transaction('rw', this.db.timerEntries, async () => {
          if (!lastSyncTime) {
            await this.db.timerEntries.clear();
            await this.db.timerEntries.bulkAdd(updatedEntries);
          } else {
            const entriesToUpsert = updatedEntries.filter(entry => !entry.deleted);
            const entriesToDelete = updatedEntries
              .filter(entry => entry.deleted)
              .map(entry => entry.uuid);

            if (entriesToUpsert.length > 0) await this.db.timerEntries.bulkPut(entriesToUpsert);
            if (entriesToDelete.length > 0) await this.db.timerEntries.bulkDelete(entriesToDelete);
          }
        });
        await this.loadEntries();
      }

      localStorage.setItem(this.lastSyncKey, new Date().toISOString());
    } catch (error) {
      console.error(error);
    }
  }

  async handleIncomingSync(incomingMessage: SyncMessage<TimerEntry>) {
    const action = incomingMessage.action;
    const payload = incomingMessage.payload;

    try {
      switch (action) {
        case SyncAction.CREATE:
          const exists = await this.db.timerEntries.get(payload.uuid);
          if (exists) return;
          await this.db.timerEntries.put(payload);
          break;
        case SyncAction.UPDATE:
          await this.db.timerEntries.put(payload);
          break;
        case SyncAction.DELETE:
          await this.db.timerEntries.delete(payload.uuid);
          break;
        default:
          return;
      }
      await this.loadEntries();
    } catch (error) {
      console.error(error);
    }
  }

  async loadEntries(page = 0, size = 10) {
    try {
      const allLocal = await this.db.timerEntries.orderBy('startTime').reverse().toArray();
      this.allEntriesSignal.set(allLocal);

      const start = page * size;
      this.entries.set(allLocal.slice(start, start + size));
    } catch (error) {
      console.error(error);
    }
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
    const newEntry: TimerEntry = { ...request, deleted: false };

    await this.db.transaction('rw', this.db.timerEntries, this.db.syncQueue, async () => {
      await this.db.timerEntries.add(newEntry);
      await this.db.syncQueue.add({
        entityId: request.uuid,
        entityType: 'TIMER_ENTRY',
        action: 'CREATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadEntries();
    this.processSyncQueue();
  }

  async update(uuid: string, request: UpdateTimerEntryRequest) {
    const existingEntry = await this.db.timerEntries.get(uuid);
    if (!existingEntry) return;

    const updatedEntry: TimerEntry = {
      ...existingEntry,
      ...request
    };

    await this.db.transaction('rw', this.db.timerEntries, this.db.syncQueue, async () => {
      await this.db.timerEntries.put(updatedEntry);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'TIMER_ENTRY',
        action: 'UPDATE',
        payload: request,
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadEntries();
    this.processSyncQueue();
  }

  async delete(uuid: string) {
    await this.db.transaction('rw', this.db.timerEntries, this.db.syncQueue, async () => {
      await this.db.timerEntries.delete(uuid);
      await this.db.syncQueue.add({
        entityId: uuid,
        entityType: 'TIMER_ENTRY',
        action: 'DELETE',
        payload: { uuid },
        timestamp: Date.now(),
        status: 'PENDING',
        retries: 0
      });
    });

    await this.loadEntries();
    this.processSyncQueue();
  }

  private async processSyncQueue() {
    if (!this.healthCheckService.isHealthy() || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const queue = await this.db.syncQueue
        .where('status').equals('PENDING')
        .and(item => item.entityType === 'TIMER_ENTRY')
        .toArray();

      for (const item of queue) {
        try {
          if (item.action === 'CREATE') {
            await firstValueFrom(this.entryApi.create(this.pingUrl, item.payload));
          } else if (item.action === 'UPDATE') {
            await firstValueFrom(this.entryApi.update(this.pingUrl, item.entityId, item.payload));
          } else if (item.action === 'DELETE') {
            await firstValueFrom(this.entryApi.delete(this.pingUrl, item.entityId));
          }
          await this.db.syncQueue.delete(item.id!);
        } catch (error: any) {
          const shouldBreak = await this.handleSyncError(item, error);
          if (shouldBreak) break;
        }
      }
    } finally {
      this.isSyncing = false;
    }
  }

  private async handleSyncError(item: any, error: any): Promise<boolean> {
    if (error instanceof HttpErrorResponse) {
      const isRecoverable = error.status === 429 || error.status >= 500 || error.status === 0;

      if (isRecoverable) {
        await this.db.syncQueue.update(item.id!, {
          status: 'ERROR',
          retries: (item.retries || 0) + 1,
          lastError: `HTTP ${error.status}: ${error.message}`
        });
        return true;
      }
    }
    await this.db.syncQueue.delete(item.id!);
    return false;
  }

  async exportCSV() {
    if (this.healthCheckService.isHealthy() && this.authService.isAuthenticated()) {
      this.exportServer();
    } else {
      await this.exportLocal();
    }
  }

  private exportServer() {
    this.http.get(`${this.pingUrl}/export?format=CSV`, {
      observe: 'response',
      responseType: 'blob'
    }).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) return;

        let filename = 'timer-history.csv';
        const disposition = response.headers.get('Content-Disposition');

        if (disposition && disposition.indexOf('filename=') !== -1) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
          if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }

        this.downloadBlob(blob, filename);
      },
      error: async (err) => {
        await this.exportLocal();
      }
    });
  }

  private async exportLocal() {
    const entries = await this.db.timerEntries.toArray();
    const localLabels = this.labelService.labels();
    const headers = ['labelName', 'color', 'durationSeconds', 'startTime'];

    const rows = entries.map(e => {
      const matchedLabel = localLabels.find(l => l.uuid === e.labelUuid);
      const finalLabelName = matchedLabel?.name || e.label?.name || '';
      const finalColor = matchedLabel?.color || e.label?.color || '';

      return [
        this.escapeCsvValue(finalLabelName),
        this.escapeCsvValue(finalColor),
        e.durationSeconds,
        e.startTime
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, 'timer-history-offline.csv');
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
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

  async importCSV(file: File): Promise<void> {
    if (this.healthCheckService.isHealthy() && this.authService.isAuthenticated()) {
      await this.importServer(file);
    } else {
      await this.importLocal(file);
    }
  }

  private async importServer(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', 'CSV');

    try {
      await firstValueFrom(this.http.post(`${this.pingUrl}/import`, formData));
      await this.loadEntries();
    } catch (error) {
      await this.importLocal(file);
    }
  }

  private async importLocal(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          if (!text) throw new Error('File is empty');

          const lines = text.split('\n').filter(l => l.trim().length > 0);
          if (lines.length < 2) return resolve();

          let localLabels = this.labelService.labels();
          const now = new Date().toISOString();

          await this.db.transaction('rw', this.db.timerEntries, this.db.labels, this.db.syncQueue, async () => {
            for (let i = 1; i < lines.length; i++) {
              const [labelName, color, durationStr, startTimeStr] = this.parseCsvRow(lines[i]);

              if (!durationStr || !startTimeStr) continue;

              const durationSeconds = parseInt(durationStr, 10);
              const startTime = parseInt(startTimeStr, 10);

              let label = localLabels.find(l => l.name === labelName);

              if (!label && labelName) {
                const newLabelUuid = crypto.randomUUID();
                await this.db.labels.add({
                  uuid: newLabelUuid,
                  name: labelName,
                  color: color,
                  createdAt: now,
                  updatedAt: now,
                  deleted: false
                });

                await this.db.syncQueue.add({
                  entityId: newLabelUuid,
                  entityType: 'LABEL',
                  action: 'CREATE',
                  payload: { uuid: newLabelUuid, name: labelName, color, createdAt: now, updatedAt: now },
                  timestamp: Date.now(),
                  status: 'PENDING',
                  retries: 0
                });

                localLabels = await this.db.labels.toArray();
                label = localLabels.find(l => l.name === labelName);
              }

              const labelUuid = label?.uuid || 'default-1';
              const requestUuid = crypto.randomUUID();

              const request: CreateTimerEntryRequest = {
                uuid: requestUuid,
                labelUuid,
                durationSeconds,
                startTime,
                createdAt: now,
                updatedAt: now
              };

              await this.db.timerEntries.add({
                ...request,
                deleted: false,
                label: { name: labelName, color: color }
              });

              await this.db.syncQueue.add({
                entityId: requestUuid,
                entityType: 'TIMER_ENTRY',
                action: 'CREATE',
                payload: request,
                timestamp: Date.now(),
                status: 'PENDING',
                retries: 0
              });
            }
          });

          await this.labelService.loadLabels();
          await this.loadEntries();
          this.processSyncQueue();
          resolve();
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private parseCsvRow(row: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"' && row[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}
