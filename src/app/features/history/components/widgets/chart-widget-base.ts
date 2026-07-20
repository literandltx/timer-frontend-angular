import {inject, signal, computed} from '@angular/core';
import {HistoryService} from '../../services/history.service';
import {TimerEntry} from '../../../../core/models/timer-entry.model';

export type Timeframe = 'day' | 'week' | 'month' | 'all';

export abstract class ChartWidgetBase {
  protected historyService = inject(HistoryService);

  timeframe = signal<Timeframe>('day');
  periodOffset = signal<number>(0);

  periodRange = computed(() => {
    const tf = this.timeframe();
    const offset = this.periodOffset();
    const targetDate = new Date();

    if (tf === 'day') {
      targetDate.setDate(targetDate.getDate() + offset);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {start: start.getTime(), end: end.getTime(), targetDate: start};
    } else if (tf === 'week') {
      targetDate.setDate(targetDate.getDate() + offset * 7);
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const dayOfWeek = start.getDay() || 7;
      start.setDate(start.getDate() - dayOfWeek + 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return {start: start.getTime(), end: end.getTime(), targetDate: start};
    } else if (tf === 'month') {
      targetDate.setMonth(targetDate.getMonth() + offset);
      const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 1);
      return {start: start.getTime(), end: end.getTime(), targetDate: start};
    } else {
      return {start: 0, end: Infinity, targetDate: new Date()};
    }
  });

  filteredEntries = computed(() => {
    const entries = this.historyService.entries();
    const range = this.periodRange();
    return entries.filter((entry: TimerEntry) =>
      entry.startTime >= range.start && entry.startTime < range.end
    );
  });

  setTimeframe(tf: Timeframe) {
    this.timeframe.set(tf);
    this.periodOffset.set(0);
  }

  navigatePrevious() {
    this.periodOffset.update(val => val - 1);
  }

  navigateNext() {
    this.periodOffset.update(val => val + 1);
  }

  protected formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }
}
