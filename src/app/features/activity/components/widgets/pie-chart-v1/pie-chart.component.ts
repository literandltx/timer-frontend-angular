import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HistoryService } from '../../../history.service';

export interface TimerEntry {
  uuid: string;
  labelId: string;
  durationSeconds: number;
  startTime: number;
  label?: {
    name: string;
    color: string;
  };
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

type TimeRange = 'day' | 'week' | 'month' | 'all';

@Component({
  selector: 'ns-pie-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pie-chart.component.html',
  styleUrls: ['./pie-chart.component.css']
})
export class PieChartComponent {
  private historyService = inject(HistoryService);

  range = signal<TimeRange>('day');
  offset = signal<number>(0);
  entries = this.historyService.entries;
  showPercentage = signal<boolean>(false);

  targetDate = computed(() => {
    const d = new Date();
    const r = this.range();
    const currentOffset = this.offset();

    if (r === 'day') {
      d.setDate(d.getDate() + currentOffset);
    } else if (r === 'week') {
      d.setDate(d.getDate() + currentOffset * 7);
    } else if (r === 'month') {
      d.setMonth(d.getMonth() + currentOffset);
    }
    return d;
  });

  filteredEntries = computed(() => {
    const allEntries: TimerEntry[] = this.entries() || [];
    const currentRange = this.range();
    const d = this.targetDate();
    let startTimeLimit = 0;
    let endTimeLimit = Number.MAX_SAFE_INTEGER;

    if (currentRange === 'day') {
      startTimeLimit = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      endTimeLimit = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    } else if (currentRange === 'week') {
      const firstDay = new Date(d);
      firstDay.setDate(d.getDate() - d.getDay());
      firstDay.setHours(0, 0, 0, 0);

      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 7);

      startTimeLimit = firstDay.getTime();
      endTimeLimit = lastDay.getTime();
    } else if (currentRange === 'month') {
      startTimeLimit = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      endTimeLimit = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    }

    return allEntries.filter(e => !e.deleted && e.startTime >= startTimeLimit && e.startTime < endTimeLimit);
  });

  totalDuration = computed(() => {
    return this.filteredEntries().reduce((acc, curr) => acc + curr.durationSeconds, 0);
  });

  currentDateStr = computed(() => {
    const r = this.range();
    const d = this.targetDate();
    const month = d.toLocaleString('en-US', { month: 'short' });
    const year = d.getFullYear();
    const date = d.getDate();

    if (r === 'day') return `${month} ${date}, ${year}`;
    if (r === 'month') return `${month} ${year}`;
    if (r === 'all') return 'All time';

    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startMonth = start.toLocaleString('en-US', { month: 'short' });
    const endMonth = end.toLocaleString('en-US', { month: 'short' });

    if (startMonth === endMonth) {
      return `${start.getDate()} - ${end.getDate()} ${startMonth}, ${year}`;
    }
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}, ${year}`;
  });

  avgDuration = computed(() => {
    const entries = this.filteredEntries();
    if (entries.length === 0) return '0 min';

    const totalSeconds = this.totalDuration();
    const avgSeconds = totalSeconds / entries.length;

    if (avgSeconds < 60) return `${Math.floor(avgSeconds)} sec`;

    const m = Math.floor(avgSeconds / 60);
    const h = Math.floor(m / 60);

    if (h > 0) {
      return `${h}h ${m % 60}m`;
    }
    return `${m} min`;
  });

  groupedData = computed(() => {
    const entries = this.filteredEntries();
    const total = this.totalDuration();
    const groupMap = new Map<string, { labelName: string; color: string; duration: number; percentage: number }>();

    for (const entry of entries) {
      const labelName = entry.label?.name || 'Uncategorized';
      const color = entry.label?.color || '#9ca3af';

      if (!groupMap.has(labelName)) {
        groupMap.set(labelName, { labelName, color, duration: 0, percentage: 0 });
      }
      groupMap.get(labelName)!.duration += entry.durationSeconds;
    }

    const result = Array.from(groupMap.values()).map(item => ({
      ...item,
      percentage: total > 0 ? Math.round((item.duration / total) * 100) : 0
    }));

    return result.sort((a, b) => b.duration - a.duration);
  });

  conicGradient = computed(() => {
    const data = this.groupedData();
    const total = this.totalDuration();

    if (total === 0 || data.length === 0) {
      return 'conic-gradient(#e5e7eb 0deg 360deg)';
    }

    const gradientStops: string[] = [];
    let accumulatedDegrees = 0;

    for (const item of data) {
      const percentage = item.duration / total;
      const degrees = percentage * 360;
      const start = accumulatedDegrees;
      const end = accumulatedDegrees + degrees;

      gradientStops.push(`${item.color} ${start}deg ${end}deg`);
      accumulatedDegrees = end;
    }

    return `conic-gradient(${gradientStops.join(', ')})`;
  });

  toggleListFormat() {
    this.showPercentage.update(val => !val);
  }

  onRangeChange(event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    this.range.set(selectElement.value as TimeRange);
    this.offset.set(0);
  }

  navigate(direction: number) {
    this.offset.update(val => val + direction);
  }

  formatTotalDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);

    if (h > 0 && m === 0) return `${h} h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m} m`;
  }

  formatDuration(totalSeconds: number): string {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);

    if (h > 0 && m === 0) return `${h} h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m} m`;
  }
}
