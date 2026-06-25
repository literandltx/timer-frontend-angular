import {Injectable, inject} from '@angular/core';
import {TimerEntryService} from '../../home/services/timer-entry.service';
import {LabelService} from '../../labels/services/label.service';
import {TimerOptionsService} from '../../timers/services/timer-options.service';
import {
  TimerEntry,
  CreateTimerEntryRequest,
  UpdateTimerEntryRequest
} from '../../home/models/timer-entry.model';
import {TimerOption} from '../../timers/models/timer-option.model';
import {Label} from '../../labels/models/label.model';
import {AppDB} from '../../../core/db/app.db';

@Injectable({providedIn: 'root'})
export class HistoryService {
  private entryService = inject(TimerEntryService);
  private labelService = inject(LabelService);
  private optionService = inject(TimerOptionsService);
  private db = inject(AppDB);

  public entries = this.entryService.allEntriesSignal;
  public labels = this.labelService.labels;
  public options = this.optionService.options;

  paginatedEntries() {
    return this.entryService.entries();
  }

  loadInitialData() {
    this.labelService.loadLabels();
    this.optionService.loadOptions();
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
    const labelsData = this.labels();
    const optionsData = this.options();
    const entriesData = this.entries();

    const csvRows: string[] = [];

    csvRows.push('--- LABELS ---');
    csvRows.push('uuid,name,color,createdAt,updatedAt,deleted');
    labelsData.forEach(l => {
      csvRows.push(`${l.uuid},"${l.name}",${l.color},${l.createdAt || ''},${l.updatedAt || ''},${l.deleted || false}`);
    });

    csvRows.push('');
    csvRows.push('--- OPTIONS ---');
    csvRows.push('uuid,value,createdAt,updatedAt,deleted');
    optionsData.forEach((o: TimerOption) => {
      csvRows.push(`${o.uuid},${o.value},${o.createdAt || ''},${o.updatedAt || ''},${o.deleted || false}`);
    });

    csvRows.push('');
    csvRows.push('--- ENTRIES ---');
    csvRows.push('uuid,labelId,durationSeconds,startTime,createdAt,updatedAt,deleted');
    entriesData.forEach(e => {
      csvRows.push(`${e.uuid},${e.labelId},${e.durationSeconds},${e.startTime},${e.createdAt || ''},${e.updatedAt || ''},${e.deleted || false}`);
    });

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});

    this.downloadFile(blob, `timer_export_${new Date().toISOString()}.csv`);
  }

  async importCSV(file: File) {
    try {
      const text = await file.text();
      const lines = text.split('\n');

      let currentSection = '';
      const labelsToPut: Label[] = [];
      const optionsToPut: TimerOption[] = [];
      const entriesToPut: TimerEntry[] = [];

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
          continue;
        }

        if (line.startsWith('--- METADATA: LABELS ---')) {
          currentSection = 'LABELS';
          continue;
        } else if (line.startsWith('--- METADATA: TIMER OPTIONS ---')) {
          currentSection = 'OPTIONS';
          continue;
        } else if (line.startsWith('--- TIMER ENTRIES ---')) {
          currentSection = 'ENTRIES';
          continue;
        }

        if (line.startsWith('uuid,')) {
          continue;
        }

        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

        if (currentSection === 'LABELS') {
          labelsToPut.push({
            uuid: parts[0],
            name: parts[1]?.replace(/^"|"$/g, ''),
            color: parts[2],
            createdAt: parts[3],
            updatedAt: parts[4],
            deleted: parts[5] === 'true'
          } as Label);
        } else if (currentSection === 'OPTIONS') {
          optionsToPut.push({
            uuid: parts[0],
            value: Number(parts[1]),
            createdAt: parts[2],
            updatedAt: parts[3],
            deleted: parts[4] === 'true'
          } as TimerOption);
        } else if (currentSection === 'ENTRIES') {
          entriesToPut.push({
            uuid: parts[0],
            labelId: parts[1] === 'undefined' ? undefined : parts[1],
            durationSeconds: Number(parts[2]),
            startTime: Number(parts[3]),
            createdAt: parts[4],
            updatedAt: parts[5],
            deleted: parts[6] === 'true'
          } as TimerEntry);
        }
      }

      if (labelsToPut.length > 0) {
        await this.db.labels.bulkPut(labelsToPut);
      }
      if (optionsToPut.length > 0) {
        await this.db.timerOptions.bulkPut(optionsToPut);
      }
      if (entriesToPut.length > 0) {
        await this.db.timerEntries.bulkPut(entriesToPut);
      }

      this.loadInitialData();
    } catch (error) {
      console.error('[HistoryService] Failed to parse or import combined CSV:', error);
    }
  }

  getLabelName(labelUuid: string): string {
    const label = this.labels().find(l => l.uuid === labelUuid);
    return label ? label.name : 'Unknown';
  }

  getLabelColor(labelUuid: string): string {
    const label = this.labels().find(l => l.uuid === labelUuid);
    return label ? label.color : '#ccc';
  }

  private downloadFile(blob: Blob, filename: string) {
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
