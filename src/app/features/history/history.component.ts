import {Component, OnInit, inject, ViewChild, ElementRef} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {HistoryService, TimerEntryRequest} from './service/history.service';
import {TimerEntry} from '../home/model/timer-entry.model';
import {HistoryChartComponent} from './components/history-chart.component';

const INITIAL_PAGE = 0;
const DEFAULT_PAGE_SIZE = 20;

@Component({
  selector: 'ns-app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, HistoryChartComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.css'
})
export class HistoryComponent implements OnInit {
  public historyService = inject(HistoryService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  editingEntry: Partial<TimerEntry> | null = null;
  formDateStr = '';
  formDurationMins = 0;
  currentPage = INITIAL_PAGE;
  pageSize = DEFAULT_PAGE_SIZE;

  get pageViewEntries() {
    return this.historyService.paginatedEntries();
  }

  ngOnInit() {
    this.historyService.loadInitialData();
    this.loadPage();
  }

  loadPage() {
    this.historyService.loadEntriesPage(this.currentPage, this.pageSize);
  }

  nextPage() {
    this.currentPage++;
    this.loadPage();
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.loadPage();
    }
  }

  startAdd() {
    if (this.editingEntry && !this.editingEntry.id) {
      this.editingEntry = null;
    } else {
      this.editingEntry = {labelId: undefined, durationSeconds: 0};
      this.formDateStr = this.formatDateForInput(Date.now());
      this.formDurationMins = 25;
    }
  }

  startEdit(entry: TimerEntry) {
    if (this.editingEntry?.id === entry.id) {
      this.editingEntry = null;
    } else {
      this.editingEntry = {...entry};
      this.formDateStr = this.formatDateForInput(entry.startTime);
      this.formDurationMins = Math.round(entry.durationSeconds / 60);
    }
  }

  cancel() {
    this.editingEntry = null;
  }

  async save() {
    if (!this.editingEntry || !this.editingEntry.labelId) {
      alert("Please select a label.");
      return;
    }

    const request: TimerEntryRequest = {
      labelId: this.editingEntry.labelId,
      durationSeconds: this.formDurationMins * 60,
      startTime: new Date(this.formDateStr).getTime()
    };

    await this.historyService.saveEntry(this.editingEntry.id, request);
    this.editingEntry = null;
  }

  async deleteEntry(id: number) {
    if (confirm('Delete this history record?')) {
      await this.historyService.deleteEntry(id);
    }
  }

  triggerImport() {
    this.fileInput.nativeElement.click();
  }

  exportCSV() {
    this.historyService.exportCSV();
  }

  async onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file: File | null = target.files ? target.files[0] : null;

    if (file) {
      try {
        await this.historyService.importCSV(file);
        this.currentPage = INITIAL_PAGE;
        this.loadPage();
        alert('Import successful!');
      } catch {
        alert('Import failed. Please check the file format and try again.');
      } finally {
        target.value = '';
      }
    }
  }

  getLabelName(labelId: number): string {
    return this.historyService.getLabelName(labelId);
  }

  getLabelColor(labelId: number): string {
    return this.historyService.getLabelColor(labelId);
  }

  private formatDateForInput(epoch: number): string {
    const d = new Date(epoch);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }
}
