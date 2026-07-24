import {Component, inject, Input, Output, EventEmitter, signal, computed} from '@angular/core';
import {CommonModule} from '@angular/common';
import {HistoryService} from '../../../history.service';

type Granularity = 'day' | 'week' | 'month';

interface ChartBucket {
  label: string;
  minutes: number;
}

interface ChartPoint {
  x: number;
  y: number;
}

@Component({
  selector: 'ns-line-chart-histogram-v3',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './line-chart-histogram-v3.component.html',
  styleUrl: './line-chart-histogram-v3.component.css'
})
export class LineChartHistogramComponentV3 {
  public historyService = inject(HistoryService);

  @Input() categoryLabel = 'Activity';
  @Input() labelId?: string;
  @Input() hardLimitMinutes: number | null = null;
  @Input() showComparison = true;

  @Output() optionsClick = new EventEmitter<void>();

  readonly chartWidth = 680;
  readonly chartHeight = 350;
  readonly paddingLeft = 40;
  readonly paddingRight = 12;
  readonly paddingTop = 12;
  readonly paddingBottom = 28;
  readonly viewBox = `0 0 ${this.chartWidth} ${this.chartHeight}`;

  granularity = signal<Granularity>('day');
  private referenceDate = signal<Date>(new Date());

  private currentBuckets = computed<ChartBucket[]>(() =>
    this.buildBuckets(this.referenceDate(), this.granularity())
  );

  private previousBuckets = computed<ChartBucket[]>(() => {
    if (!this.showComparison) return [];
    const prevRef = this.shiftReference(this.referenceDate(), this.granularity(), -1);
    return this.buildBuckets(prevRef, this.granularity());
  });

  rangeLabel = computed(() => this.buildRangeLabel(this.referenceDate(), this.granularity()));

  avgMinutes = computed(() => {
    const active = this.currentBuckets().filter(b => b.minutes > 0);
    if (!active.length) return 0;
    return Math.round(active.reduce((sum, b) => sum + b.minutes, 0) / active.length);
  });

  private maxValue = computed(() => {
    const dataMax = Math.max(
      0,
      ...this.currentBuckets().map(b => b.minutes),
      ...this.previousBuckets().map(b => b.minutes),
      this.hardLimitMinutes ?? 0
    );
    return this.niceMax(dataMax);
  });

  gridLines = computed(() => {
    const max = this.maxValue();
    const step = max / 5;
    return [step, step * 2, step * 3, step * 4, step * 5].map(value => ({
      value: Math.round(value),
      y: this.valueToY(value)
    }));
  });

  hardLimitY = computed(() => {
    if (this.hardLimitMinutes == null) return null;
    return this.valueToY(this.hardLimitMinutes);
  });

  points = computed(() => this.toPoints(this.currentBuckets()));
  private comparePoints = computed(() => this.toPoints(this.previousBuckets()));

  areaPath = computed(() => this.toAreaPath(this.points()));
  linePath = computed(() => this.toLinePath(this.points()));
  compareLinePath = computed(() => this.toLinePath(this.comparePoints()));

  visibleXLabels = computed(() => {
    const buckets = this.currentBuckets();
    const pts = this.points();

    if (buckets.length <= 16) {
      return buckets.map((b, i) => ({key: i, label: b.label, x: pts[i]?.x ?? 0}));
    }

    const step = Math.ceil(buckets.length / 20);
    return buckets
      .map((b, i) => ({key: i, label: b.label, x: pts[i]?.x ?? 0}))
      .filter((_, i) => {
        if (i === buckets.length - 1) return true;

        if (i % step === 0) {
          return (buckets.length - 1 - i) >= step;
        }

        return false;
      });
  });

  prev() {
    this.referenceDate.set(this.shiftReference(this.referenceDate(), this.granularity(), -1));
  }

  next() {
    this.referenceDate.set(this.shiftReference(this.referenceDate(), this.granularity(), 1));
  }

  setGranularity(value: Granularity) {
    this.granularity.set(value);
  }

  onOptionsClick() {
    this.optionsClick.emit();
  }

  private buildBuckets(ref: Date, granularity: Granularity): ChartBucket[] {
    const entries = this.historyService
      .entries()
      .filter(e => !e.deleted && (!this.labelId || e.labelId === this.labelId));

    if (granularity === 'day') {
      const year = ref.getFullYear();
      const month = ref.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const totals = new Array(daysInMonth).fill(0);

      entries.forEach(e => {
        const d = new Date(e.startTime);
        if (d.getFullYear() === year && d.getMonth() === month) {
          totals[d.getDate() - 1] += e.durationSeconds;
        }
      });

      return totals.map((secs, i) => ({label: String(i + 1), minutes: Math.round(secs / 60)}));
    }

    if (granularity === 'week') {
      const year = ref.getFullYear();
      const month = ref.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const weekCount = Math.ceil(daysInMonth / 7);
      const totals = new Array(weekCount).fill(0);

      entries.forEach(e => {
        const d = new Date(e.startTime);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const weekIdx = Math.floor((d.getDate() - 1) / 7);
          totals[weekIdx] += e.durationSeconds;
        }
      });

      return totals.map((secs, i) => ({label: `W${i + 1}`, minutes: Math.round(secs / 60)}));
    }

    const year = ref.getFullYear();
    const totals = new Array(12).fill(0);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    entries.forEach(e => {
      const d = new Date(e.startTime);
      if (d.getFullYear() === year) {
        totals[d.getMonth()] += e.durationSeconds;
      }
    });

    return totals.map((secs, i) => ({label: monthNames[i], minutes: Math.round(secs / 60)}));
  }

  private shiftReference(ref: Date, granularity: Granularity, dir: number): Date {
    const d = new Date(ref);
    if (granularity === 'day' || granularity === 'week') {
      d.setMonth(d.getMonth() + dir);
    } else {
      d.setFullYear(d.getFullYear() + dir);
    }
    return d;
  }

  private buildRangeLabel(ref: Date, granularity: Granularity): string {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    if (granularity === 'day' || granularity === 'week') {
      const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
      return `${monthNames[ref.getMonth()]} 1 - ${monthNames[ref.getMonth()]} ${lastDay}`;
    }

    return `${ref.getFullYear()}`;
  }

  private niceMax(value: number): number {
    if (value <= 0) return 60;
    const rawStep = value / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / magnitude;

    let niceStep: number;
    if (normalized <= 1) niceStep = 1;
    else if (normalized <= 2) niceStep = 2;
    else if (normalized <= 5) niceStep = 5;
    else niceStep = 10;

    return niceStep * magnitude * 4;
  }

  private valueToY(value: number): number {
    const max = this.maxValue();
    const usable = this.chartHeight - this.paddingTop - this.paddingBottom;
    const ratio = max === 0 ? 0 : value / max;
    return this.paddingTop + usable - ratio * usable;
  }

  private toPoints(buckets: ChartBucket[]): ChartPoint[] {
    const usableWidth = this.chartWidth - this.paddingLeft - this.paddingRight;
    const count = buckets.length;

    return buckets.map((b, i) => ({
      x: this.paddingLeft + (count <= 1 ? 0 : (usableWidth * i) / (count - 1)),
      y: this.valueToY(b.minutes)
    }));
  }

  private toLinePath(points: ChartPoint[]): string {
    if (!points.length) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  private toAreaPath(points: ChartPoint[]): string {
    if (!points.length) return '';
    const baseline = this.chartHeight - this.paddingBottom;
    const first = points[0];
    const last = points[points.length - 1];
    const line = this.toLinePath(points);
    return `${line} L ${last.x.toFixed(1)} ${baseline} L ${first.x.toFixed(1)} ${baseline} Z`;
  }
}
