import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import {TimerService} from './timer.service';

const noop = () => { /* empty */ };

@Component({
  selector: 'ns-app-timer',
  standalone: true,
  templateUrl: './timer.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./timer.component.css']
})
export class TimerComponent implements OnInit, OnDestroy, OnChanges {
  @Input({required: true}) timeAmount!: number;
  @Output() timerFinish = new EventEmitter<{ durationUsed: number }>();
  @Output() timerReset = new EventEmitter<{ durationUsed: number }>();

  timerService = inject(TimerService);
  private lastClickTime = 0;

  readonly radius = 140;
  readonly center = 150;
  readonly strokeWidth = 3;
  readonly circumference = 2 * Math.PI * this.radius;

  private elapsedFraction = computed(() => {
    const initial = this.timerService.initialTimeSignal();
    if (initial <= 0) {
      return 0;
    }
    const remaining = this.timerService.timeLeft();
    return 1 - remaining / initial;
  });

  dashOffset = computed(() => -this.circumference * this.elapsedFraction());

  dotPosition = computed(() => {
    const angleDeg = -90 + this.elapsedFraction() * 360;
    const angleRad = (angleDeg * Math.PI) / 180;
    return {
      x: this.center + this.radius * Math.cos(angleRad),
      y: this.center + this.radius * Math.sin(angleRad)
    };
  });

  ngOnInit() {
    if (this.timerService.getInitialTime() !== this.timeAmount) {
      this.timerService.reset(this.timeAmount);
    }
    this.timerService.setCallback(() => {
      this.timerFinish.emit({durationUsed: this.timeAmount});
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['timeAmount'] && !changes['timeAmount'].isFirstChange()) {
      this.handleDoubleClick();
      this.timerService.reset(this.timeAmount);
    }
  }

  ngOnDestroy() {
    this.timerService.setCallback(noop);
  }

  onUserClick() {
    const currentTime = Date.now();
    const timeSinceLastClick = currentTime - this.lastClickTime;

    if (timeSinceLastClick > 0 && timeSinceLastClick < 300) {
      this.handleDoubleClick();
      this.lastClickTime = 0;
    } else {
      this.handleClick();
      this.lastClickTime = currentTime;
    }
  }

  handleClick() {
    this.timerService.toggle();
  }

  handleDoubleClick() {
    const durationUsed = this.timerService.getDurationUsed();
    if (durationUsed > 0) {
      this.timerReset.emit({durationUsed});
    }
    this.timerService.reset(this.timeAmount);
  }
}
