import {Injectable, inject, Signal} from '@angular/core';
import {TimerEntryService} from '../timer/entry/timer-entry.service';
import {LabelService} from '../labels/label.service';
import {TimerEntry} from '../timer/entry/timer-entry.model';
import {Label} from '../labels/label.model';

export interface TimerEntryRequest {
  labelId: number;
  durationSeconds: number;
  startTime: number;
}

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private entryService = inject(TimerEntryService);
  private labelService = inject(LabelService);

  get entries(): TimerEntry[] {
    return this.entryService.allLocalEntries;
  }

  get labels(): Signal<Label[]> {
    return this.labelService.labels;
  }

  get paginatedEntries(): Signal<TimerEntry[]> {
    return this.entryService.entries;
  }

  loadInitialData(): void {
    this.labelService.loadLabels();
  }

  loadEntriesPage(page: number, size: number): void {
    this.entryService.loadEntries(page, size);
  }

  async saveEntry(id: number | undefined, request: TimerEntryRequest): Promise<void> {
    if (id) {
      await this.entryService.update(id, request);
    } else {
      await this.entryService.save(request);
    }
  }

  async deleteEntry(id: number): Promise<void> {
    await this.entryService.delete(id);
  }

  async importCSV(file: File): Promise<void> {
    await this.entryService.importCSV(file);
  }

  exportCSV(): void {
    this.entryService.exportCSV();
  }

  getLabelName(labelId: number): string {
    const label = this.labelService.labels().find(l => l.id === labelId);
    return label ? label.name : 'Unknown Label';
  }

  getLabelColor(labelId: number): string {
    const label = this.labelService.labels().find(l => l.id === labelId);
    return label ? label.color : '#ccc';
  }
}
