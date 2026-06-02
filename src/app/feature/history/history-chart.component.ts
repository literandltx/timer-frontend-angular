import {Component, computed, inject, signal} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from './history.service';
import {TimerEntry} from '../timer/entry/timer-entry.model';

type Timeframe = 'day' | 'week' | 'month' | 'all';
type ChartType = 'pie' | 'bar';

const days: string[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

  chartData = computed(() => {
    const entries = this.historyService.entries;
    const range = this.periodRange();

    const filteredEntries = entries.filter((entry: TimerEntry) => {
      return entry.startTime >= range.start && entry.startTime < range.end;
    });

    const aggregated = new Map<number, number>();
    let totalSeconds = 0;

    for (const entry of filteredEntries) {
      const current = aggregated.get(entry.labelId) || 0;
      aggregated.set(entry.labelId, current + entry.durationSeconds);
      totalSeconds += entry.durationSeconds;
    }

    const sortedData = Array.from(aggregated.entries()).sort((a, b) => b[1] - a[1]);

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
    const range = this.periodRange();

    const filteredEntries = entries.filter((entry: TimerEntry) => {
      return entry.startTime >= range.start && entry.startTime < range.end;
    });

    const buckets: {
      id: number,
      titleLabel: string,
      displayLabel: string,
      totalSeconds: number,
      entries: { color: string, seconds: number }[]
    }[] = [];
    let totalSeconds = 0;
    let averageLabel = 'Daily average';
    let averageValue = 0;
    const daysInMonth = new Date(range.targetDate.getFullYear(), range.targetDate.getMonth() + 1, 0).getDate();

    const dayXTicks = [
      {label: '00:00', position: 0},
      {label: '04:00', position: 16.666},
      {label: '08:00', position: 33.333},
      {label: '12:00', position: 50},
      {label: '16:00', position: 66.666},
      {label: '20:00', position: 83.333},
      {label: '24:00', position: 100}
    ];

    if (tf === 'day') {
      averageLabel = 'Hourly average';
      for (let i = 0; i < 24; i++) {
        buckets.push({
          id: i,
          titleLabel: `${i.toString().padStart(2, '0')}:00`,
          displayLabel: '',
          totalSeconds: 0,
          entries: []
        });
      }
      for (const entry of filteredEntries) {
        const hour = new Date(entry.startTime).getHours();
        const color = this.historyService.getLabelColor(entry.labelId);
        buckets[hour].totalSeconds += entry.durationSeconds;
        buckets[hour].entries.push({color, seconds: entry.durationSeconds});
        totalSeconds += entry.durationSeconds;
      }
      averageValue = Math.round((totalSeconds / 60) / 24);

    } else if (tf === 'week') {
      for (let i = 0; i < days.length; i++) {
        buckets.push({
          id: i,
          titleLabel: days[i],
          displayLabel: days[i],
          totalSeconds: 0,
          entries: []
        });
      }
      for (const entry of filteredEntries) {
        const entryDate = new Date(entry.startTime);
        const dayIdx = (entryDate.getDay() || 7) - 1;
        const color = this.historyService.getLabelColor(entry.labelId);
        buckets[dayIdx].totalSeconds += entry.durationSeconds;
        buckets[dayIdx].entries.push({color, seconds: entry.durationSeconds});
        totalSeconds += entry.durationSeconds;
      }
      averageValue = Math.round((totalSeconds / 60) / 7);

    } else if (tf === 'month') {
      for (let i = 1; i <= daysInMonth; i++) {
        buckets.push({
          id: i,
          titleLabel: `Day ${i}`,
          displayLabel: (i === 1 || i % 5 === 0) ? i.toString() : '',
          totalSeconds: 0,
          entries: []
        });
      }
      for (const entry of filteredEntries) {
        const date = new Date(entry.startTime).getDate();
        const color = this.historyService.getLabelColor(entry.labelId);
        buckets[date - 1].totalSeconds += entry.durationSeconds;
        buckets[date - 1].entries.push({color, seconds: entry.durationSeconds});
        totalSeconds += entry.durationSeconds;
      }
      averageValue = Math.round((totalSeconds / 60) / daysInMonth);
    }

    for (const bucket of buckets) {
      const colorMap = new Map<string, number>();
      for (const e of bucket.entries) {
        colorMap.set(e.color, (colorMap.get(e.color) || 0) + e.seconds);
      }
      bucket.entries = Array.from(colorMap.entries()).map(([color, seconds]) => ({color, seconds}));
    }

    const maxBucketSeconds = Math.max(...buckets.map(d => d.totalSeconds), 1);
    const maxMinutes = Math.max(Math.ceil(maxBucketSeconds / 60), 10);

    let stepMinutes = 15;
    if (tf === 'day' && maxMinutes <= 60) {
      if (maxMinutes <= 10) {
        stepMinutes = 2;
      } else if (maxMinutes <= 25) {
        stepMinutes = 5;
      } else if (maxMinutes <= 50) {
        stepMinutes = 10;
      } else {
        stepMinutes = 15;
      }
    } else {
      if (maxMinutes > 600) {
        stepMinutes = Math.ceil(maxMinutes / 5 / 60) * 60;
      } else if (maxMinutes <= 60) {
        stepMinutes = 15;
      } else {
        stepMinutes = Math.ceil(maxMinutes / 5 / 30) * 30;
      }
    }

    const yMaxMinutes = stepMinutes * 5;
    const yLabels = [5, 4, 3, 2, 1, 0].map(i => i * stepMinutes);

    const bucketsView = buckets.map(b => {
      const stacks = b.entries.map(e => ({
        color: e.color,
        heightPct: (e.seconds / 60 / yMaxMinutes) * 100
      }));

      const totalMins = Math.round(b.totalSeconds / 60);
      const titleStr = `${b.titleLabel}: ${totalMins} min`;

      return {id: b.id, displayLabel: b.displayLabel, titleStr, stacks};
    });

    let dateRangeStr = 'This Period';
    let titleStr = 'Current Period';

    const offset = this.periodOffset();

    if (tf === 'week') {
      const weekStart = range.targetDate;
      const endOfWeekDate = new Date(range.end - 1);
      dateRangeStr = `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${monthNames[endOfWeekDate.getMonth()]} ${endOfWeekDate.getDate()}`;
      titleStr = offset === 0 ? 'Current Week' : offset === -1 ? 'Last Week' : `${offset > 0 ? '+' : ''}${offset} Weeks`;
    } else if (tf === 'day') {
      const dayDate = range.targetDate;
      dateRangeStr = `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}, ${dayDate.getFullYear()}`;
      titleStr = offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : `${monthNames[dayDate.getMonth()]} ${dayDate.getDate()}`;
    } else if (tf === 'month') {
      const monthStart = range.targetDate;
      dateRangeStr = `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
      titleStr = offset === 0 ? 'This Month' : offset === -1 ? 'Last Month' : `${monthNames[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
    }

    return {
      title: titleStr,
      buckets: bucketsView,
      dayXTicks,
      yLabels,
      averageLabel,
      averageValue,
      dateRange: dateRangeStr
    };
  });

  setTimeframe(tf: Timeframe) {
    this.timeframe.set(tf);
    this.periodOffset.set(0);
  }

  setChartType(type: ChartType) {
    this.chartType.set(type);
  }

  navigatePrevious() {
    this.periodOffset.update(val => val - 1);
  }

  navigateNext() {
    this.periodOffset.update(val => val + 1);
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
