import {Injectable, inject} from '@angular/core';
import {TimerEntryService} from '../../home/services/timer-entry.service';
import {LabelService} from '../../labels/services/label.service';
import {
  TimerEntry,
  CreateTimerEntryRequest,
  UpdateTimerEntryRequest
} from '../../home/models/timer-entry.model';

@Injectable({providedIn: 'root'})
export class HistoryService {
  private entryService = inject(TimerEntryService);
  private labelService = inject(LabelService);

  public entries = this.entryService.allEntriesSignal;
  public labels = this.labelService.labels;

  paginatedEntries() {
    return this.entryService.entries();
  }

  loadInitialData() {
    this.labelService.loadLabels();
    this.entryService.loadEntries(0, 20);
  }

  loadEntriesPage(page: number, size: number) {
    this.entryService.loadEntries(page, size);
  }

  async create(request: CreateTimerEntryRequest) {
    await this.entryService.save(request);
  }

  async update(uuid: string, request: UpdateTimerEntryRequest) {
    await this.entryService.update(uuid, request);
  }

  async delete(uuid: string) {
    await this.entryService.delete(uuid);
  }

  exportCSV() {
    this.entryService.exportCSV();
  }

  async importCSV(file: File) {
    await this.entryService.importCSV(file);
  }

  getLabelName(labelUuid: string): string {
    const label = this.labelService.labels().find(l => l.uuid === labelUuid);
    return label ? label.name : 'Unknown';
  }

  getLabelColor(labelUuid: string): string {
    const label = this.labelService.labels().find(l => l.uuid === labelUuid);
    return label ? label.color : '#ccc';
  }
}
