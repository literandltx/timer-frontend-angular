import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from './history.service';
import {TimerEntry} from '../timer/entry/timer-entry.model';

type Timeframe = 'day' | 'week' | 'month' | 'all';
type ChartType = 'pie' | 'bar';

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
  chartType = signal<ChartType>('pie');

  chartData = computed(() => {
    const entries = this.historyService.entries;
    const tf = this.timeframe();

    const now = new Date();

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + 1);
    const startOfWeek = weekStart.getTime();

    const monthStart = new Date(today);
    monthStart.setDate(1);
    const startOfMonth = monthStart.getTime();

    const filteredEntries = entries.filter((entry: TimerEntry) => {
      if (tf === 'day') return entry.startTime >= startOfDay;
      if (tf === 'week') return entry.startTime >= startOfWeek;
      if (tf === 'month') return entry.startTime >= startOfMonth;
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
    let maxRawSeconds = 0;

    for (const [labelId, duration] of sortedData) {
      const percentage = totalSeconds > 0 ? (duration / totalSeconds) * 100 : 0;
      const labelName = this.historyService.getLabelName(labelId);
      const color = this.historyService.getLabelColor(labelId);

      if (duration > maxRawSeconds) {
        maxRawSeconds = duration;
      }

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
      legend: legend,
      maxRawSeconds: maxRawSeconds
    };
  });

  barChartData = computed(() => {
    const entries = this.historyService.entries;
    const tf = this.timeframe();
    const now = new Date();

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + 1);
    const startOfWeek = weekStart.getTime();

    const monthStart = new Date(today);
    monthStart.setDate(1);
    const startOfMonth = monthStart.getTime();

    const filteredEntries = entries.filter((entry: TimerEntry) => {
      if (tf === 'day') return entry.startTime >= startOfDay;
      if (tf === 'week') return entry.startTime >= startOfWeek;
      if (tf === 'month') return entry.startTime >= startOfMonth;
      return true;
    });

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayData = days.map(name => ({
      name,
      totalSeconds: 0,
      entries: [] as { color: string, seconds: number }[]
    }));

    let totalSeconds = 0;

    for (const entry of filteredEntries) {
      const entryDate = new Date(entry.startTime);
      const entryDayIdx = (entryDate.getDay() || 7) - 1; // 0 for Mon, 6 for Sun

      const color = this.historyService.getLabelColor(entry.labelId);
      dayData[entryDayIdx].totalSeconds += entry.durationSeconds;
      dayData[entryDayIdx].entries.push({ color, seconds: entry.durationSeconds });
      totalSeconds += entry.durationSeconds;
    }

    // Consolidate identical colors per day into single stacks
    for (const day of dayData) {
      const colorMap = new Map<string, number>();
      for (const e of day.entries) {
        colorMap.set(e.color, (colorMap.get(e.color) || 0) + e.seconds);
      }
      day.entries = Array.from(colorMap.entries()).map(([color, seconds]) => ({ color, seconds }));
    }

    const maxDailySeconds = Math.max(...dayData.map(d => d.totalSeconds), 1);
    const maxMinutes = Math.max(Math.ceil(maxDailySeconds / 60), 10);

    // Calculate Y-axis scaling logic (e.g., matching the 120, 240, 360 intervals)
    let stepMinutes = 120;
    if (maxMinutes > 600) stepMinutes = Math.ceil(maxMinutes / 5 / 60) * 60;
    else if (maxMinutes <= 60) stepMinutes = 15;
    else stepMinutes = Math.ceil(maxMinutes / 5 / 30) * 30;

    const yMaxMinutes = stepMinutes * 5;
    // Creates 6 lines: [100%, 80%, 60%, 40%, 20%, 0%]
    const yLabels = [5, 4, 3, 2, 1, 0].map(i => i * stepMinutes);

    const daysView = dayData.map(d => {
      const stacks = d.entries.map(e => ({
        color: e.color,
        heightPct: (e.seconds / 60 / yMaxMinutes) * 100
      }));

      return {
        name: d.name,
        stacks
      };
    });

    const dailyAverageMinutes = Math.round((totalSeconds / 60) / (tf === 'day' ? 1 : 7));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let dateRange = 'This Week';
    let title = 'Current Period';

    if (tf === 'week') {
      const endOfWeekDate = new Date(startOfWeek + 6 * 24 * 60 * 60 * 1000);
      dateRange = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${monthNames[endOfWeekDate.getMonth()]} ${endOfWeekDate.getDate()}`;
      title = 'Current Week';
    } else if (tf === 'day') {
      dateRange = `Today, ${monthNames[today.getMonth()]} ${today.getDate()}`;
      title = 'Today';
    } else if (tf === 'month') {
      dateRange = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
      title = 'This Month';
    }

    return {
      title,
      days: daysView,
      yLabels,
      dailyAverage: dailyAverageMinutes,
      dateRange
    };
  });

  setTimeframe(tf: Timeframe) {
    this.timeframe.set(tf);
  }

  setChartType(type: ChartType) {
    this.chartType.set(type);
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
