import {Injectable, signal, inject} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {TimerEntry, TimerEntryRequest} from './timer-entry.model';
import {BaseOfflineSyncService} from '../../core/service/base-offline-sync.service';
import {HttpErrorResponse} from '@angular/common/http';
import {LabelService} from '../labels/label.service';

interface SyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: TimerEntryRequest;
  entryId?: number;
  tempId?: number;
}

const DEFAULT_MINIMUM_TIMER_DURATION = 60;

@Injectable({providedIn: 'root'})
export class TimerEntryService extends BaseOfflineSyncService<SyncAction> {
  protected pingUrl = 'http://localhost:8080/api/v1/timer-entries';
  protected queueKey = 'timer_entry_sync_queue';

  private labelService = inject(LabelService);
  private allEntriesSignal = signal<TimerEntry[]>(this.getLocalEntries());
  entries = signal<TimerEntry[]>([]);

  get allLocalEntries() {
    return this.allEntriesSignal();
  }

  loadEntries(page = 0, size = 10) {
    const allLocal = this.getLocalEntries();
    const start = page * size;
    this.entries.set(allLocal.slice(start, start + size));

    if (this.isOnline() && this.getQueue().length === 0 && this.authService.isAuthenticated()) {
      this.http.get<TimerEntry[]>(`${this.pingUrl}?page=${page}&size=${size}`).subscribe({
        next: (data) => {
          this.entries.set(data);
          if (page === 0) {
            const currentLocal = this.getLocalEntries();
            const serverIds = new Set(data.map(e => e.id));
            const merged = [
              ...data,
              ...currentLocal.filter(e => !serverIds.has(e.id))
            ];

            this.updateLocalState(() => merged);
          }
        },
        error: (err) => console.error('Background fetch failed', err)
      });
    }
  }

  recordTimerFinish(durationSeconds: number, activeLabelId?: number, fallbackLabelId?: number) {
    const finalLabelId = activeLabelId || fallbackLabelId;

    if (!finalLabelId) {
      console.warn("No label selected, cannot save timer history.");
      return;
    }

    const finalDuration = Math.max(durationSeconds, DEFAULT_MINIMUM_TIMER_DURATION);
    const startTime = Date.now() - (finalDuration * 1000);
    const request: TimerEntryRequest = {
      labelId: finalLabelId,
      durationSeconds: finalDuration,
      startTime: startTime
    };

    this.save(request);
  }

  async save(request: TimerEntryRequest) {
    const tempId = -Date.now();
    const newEntry: TimerEntry = {...request, id: tempId};

    this.updateLocalState(entries => [newEntry, ...entries]);
    this.enqueueAction({type: 'CREATE', payload: request, tempId});
  }

  async update(id: number, request: TimerEntryRequest) {
    this.updateLocalState(entries =>
      entries.map(e => e.id === id ? {...e, ...request} : e)
    );

    const queue = this.getQueue();
    const pendingCreate = queue.find(a => a.type === 'CREATE' && a.tempId === id);

    if (pendingCreate) {
      pendingCreate.payload = request;
      this.setQueue(queue);
    } else {
      this.enqueueAction({type: 'UPDATE', entryId: id, payload: request});
    }
  }

  async delete(id: number) {
    this.updateLocalState(entries => entries.filter(e => e.id !== id));

    const queue = this.getQueue();
    if (id < 0) {
      this.setQueue(queue.filter(a => !(a.tempId === id || a.entryId === id)));
    } else {
      this.enqueueAction({type: 'DELETE', entryId: id});
    }
  }

  exportCSV() {
    if (this.isOnline() && this.authService.isAuthenticated()) {
      this.exportServer();
    } else {
      this.exportLocal();
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
      error: (err) => {
        console.error('Server export failed, falling back to local export', err);
        this.exportLocal();
      }
    });
  }

  private exportLocal() {
    console.log('Exporting CSV from local storage...');
    const entries = this.getLocalEntries();
    const localLabels = this.labelService.labels();
    const headers = ['labelName', 'color', 'durationSeconds', 'startTime'];
    const rows = entries.map(e => {
      const matchedLabel = localLabels.find(l => l.id === e.labelId);
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
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
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
    if (this.isOnline() && this.authService.isAuthenticated()) {
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
      this.loadEntries();
    } catch (error) {
      console.error('Server import failed, falling back to local import', error);
      await this.importLocal(file);
    }
  }

  private async importLocal(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          if (!text) {
            throw new Error('File is empty');
          }

          const lines = text.split('\n').filter(l => l.trim().length > 0);
          if (lines.length < 2) {
            return resolve();
          }

          const newEntries: TimerEntry[] = [];
          let localLabels = this.labelService.labels();

          for (let i = 1; i < lines.length; i++) {
            const [labelName, color, durationStr, startTimeStr] = this.parseCsvRow(lines[i]);

            if (!durationStr || !startTimeStr) continue;

            const durationSeconds = parseInt(durationStr, 10);
            const startTime = parseInt(startTimeStr, 10);

            let label = localLabels.find(l => l.name === labelName);

            if (!label && labelName) {
              await this.labelService.save({name: labelName, color: color});
              localLabels = this.labelService.labels();
              label = localLabels.find(l => l.name === labelName);
            }

            const labelId = label?.id || 0;
            const request: TimerEntryRequest = {labelId, durationSeconds, startTime};
            const tempId = -(Date.now() + i);

            const newEntry: TimerEntry = {
              ...request,
              id: tempId,
              label: {name: labelName, color: color}
            };

            newEntries.push(newEntry);
            this.enqueueAction({type: 'CREATE', payload: request, tempId});
          }

          this.updateLocalState(entries => [...newEntries, ...entries]);
          resolve();
        } catch (err) {
          console.error('Failed to parse offline CSV', err);
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

  private updateLocalState(updateFn: (entries: TimerEntry[]) => TimerEntry[]) {
    const current = this.getLocalEntries();
    const updated = updateFn(current);
    this.setLocalEntries(updated);
    this.allEntriesSignal.set(updated);
    this.entries.update(currentView => updateFn(currentView));
  }

  private getLocalEntries(): TimerEntry[] {
    return JSON.parse(localStorage.getItem('timer_entries') || '[]');
  }

  private setLocalEntries(entries: TimerEntry[]) {
    localStorage.setItem('timer_entries', JSON.stringify(entries));
  }

  protected async syncQueue() {
    if (!this.isOnline() || this.isSyncing() || !this.authService.isAuthenticated()) return;

    const queue = this.getQueue();
    if (queue.length === 0) return;

    this.isSyncing.set(true);

    try {
      for (let i = 0; i < queue.length; i++) {
        const action = queue[i];

        try {
          if (action.type === 'CREATE') {
            const saved = await firstValueFrom(this.http.post<TimerEntry>(this.pingUrl, action.payload));
            this.replaceLocalId(action.tempId!, saved.id);
            this.updateQueueIds(action.tempId!, saved.id);
          } else if (action.type === 'UPDATE') {
            await firstValueFrom(this.http.put<TimerEntry>(`${this.pingUrl}/${action.entryId}`, action.payload));
          } else if (action.type === 'DELETE') {
            await firstValueFrom(this.http.delete<void>(`${this.pingUrl}/${action.entryId}`));
          }

          this.setQueue(this.getQueue().filter(a => a.id !== action.id));

          if (i < queue.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1100));
          }

        } catch (err: unknown) {
          if (err instanceof HttpErrorResponse) {
            if (err.status === 0 || err.status === 429 || err.status >= 500) {
              if (err.status !== 429) this.isOnline.set(false);
              break;
            }
          }

          console.error(`Permanent error on action ${action.id}, dropping.`, err);
          this.setQueue(this.getQueue().filter(a => a.id !== action.id));
        }
      }
    } finally {
      this.isSyncing.set(false);
    }
  }

  private replaceLocalId(oldId: number, newId: number) {
    this.updateLocalState(entries =>
      entries.map(e => e.id === oldId ? {...e, id: newId} : e)
    );
  }

  private updateQueueIds(oldId: number, newId: number) {
    const queue = this.getQueue();
    queue.forEach(action => {
      if (action.entryId === oldId) action.entryId = newId;
    });
    this.setQueue(queue);
  }
}
