import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from './history.service';
import {TimerEntry} from '../timer/entry/timer-entry.model';

type Timeframe = 'day' | 'week' | 'month' | 'all';

interface ChartLegendItem {
  name: string;
  color: string;
  formattedTime: string;
  percentage: number;
  rawSeconds: number;
}

@Component({
  selector: 'ns-history-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './history-chart.component.html',
  styleUrl: './history-chart.component.css'
})
export class HistoryChartComponent {
  public historyService = inject(HistoryService);

  timeframe = signal<Timeframe>('day');

  chartData = computed(() => {
    const entries = this.historyService.entries;
    const tf = this.timeframe();

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 1).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const filteredEntries = entries.filter((entry: TimerEntry) => {
      if (tf === 'day') {
        return entry.startTime >= startOfDay;
      }
      if (tf === 'week') {
        return entry.startTime >= startOfWeek;
      }
      if (tf === 'month') {
        return entry.startTime >= startOfMonth;
      }
      return true;
    });

    const aggregated = new Map<number, number>();
    let totalSeconds = 0;

    for (const entry of filteredEntries) {
      const current = aggregated.get(entry.labelId) || 0;
      aggregated.set(entry.labelId, current + entry.durationSeconds);
      totalSeconds += entry.durationSeconds;
    }

    const sortedData = Array.from(aggregated.entries())
      .sort((a, b) => b[1] - a[1]);

    let currentPercentage = 0;
    const slices: string[] = [];
    const legend: ChartLegendItem[] = [];

    for (const [labelId, duration] of sortedData) {
      const percentage = totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0;
      const labelName = this.historyService.getLabelName(labelId);
      const color = this.historyService.getLabelColor(labelId);

      slices.push(`${color} ${currentPercentage}% ${currentPercentage + percentage}%`);

      legend.push({
        name: labelName,
        color,
        formattedTime: this.formatTime(duration),
        percentage: Math.round(percentage),
        rawSeconds: duration
      });

      currentPercentage += percentage;
    }

    return {
      hasData: totalSeconds > 0,
      formattedTotal: this.formatTime(totalSeconds),
      conicStyle: slices.length > 0 ? `conic-gradient(${slices.join(', ')})` : 'none',
      legend: legend
    };
  });

  setTimeframe(tf: Timeframe) {
    this.timeframe.set(tf);
  }

  private formatTime(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }
}
