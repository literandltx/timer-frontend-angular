import {Injectable, signal} from '@angular/core';
import {firstValueFrom} from 'rxjs';
import {TimerEntry, TimerEntryRequest} from './timer-entry.model';
import {BaseOfflineSyncService} from '../../../core/utils/base-offline-sync.service';

interface SyncAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload?: TimerEntryRequest;
  entryId?: number;
  tempId?: number;
}

@Injectable({providedIn: 'root'})
export class TimerEntryService extends BaseOfflineSyncService<SyncAction> {
  protected pingUrl = 'http://localhost:8080/api/v1/timer-entries';
  protected queueKey = 'timer_entry_sync_queue';

  entries = signal<TimerEntry[]>([]);

  loadEntries() {
    this.entries.set(this.getLocalEntries());

    if (this.isOnline() && this.getQueue().length === 0 && this.authService.isAuthenticated()) {
      this.http.get<TimerEntry[]>(this.pingUrl).subscribe({
        next: (data) => {
          this.setLocalEntries(data);
          this.entries.set(data);
        },
        error: (err) => console.error('Background fetch failed', err)
      });
    }
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

        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Export failed', err);
        alert('Failed to export CSV. Please try again.');
      }
    });
  }

  async importCSV(file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('format', 'CSV');

    try {
      await firstValueFrom(this.http.post(`${this.pingUrl}/import`, formData));
      this.loadEntries();
    } catch (error) {
      console.error('Import failed', error);
      throw error;
    }
  }

  private updateLocalState(updateFn: (entries: TimerEntry[]) => TimerEntry[]) {
    const current = this.getLocalEntries();
    const updated = updateFn(current);
    this.setLocalEntries(updated);
    this.entries.set(updated);
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

        } catch (err: any) {
          if (err.status === 0 || err.status === 429 || err.status >= 500) {
            if (err.status !== 429) {
              this.isOnline.set(false);
            }
            break;
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
