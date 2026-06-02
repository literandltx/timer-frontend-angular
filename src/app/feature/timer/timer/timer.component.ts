import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  inject
} from '@angular/core';
import {TimerService} from './timer.service';

@Component({
  selector: 'ns-app-timer',
  standalone: true,
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.css']
})
export class TimerComponent implements OnInit, OnDestroy, OnChanges {
  @Input({required: true}) timeAmount!: number;
  @Output() timerFinish = new EventEmitter<{ durationUsed: number }>();
  @Output() timerReset = new EventEmitter<{ durationUsed: number }>();

  timerService = inject(TimerService);

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
    this.timerService.setCallback(() => {
    });
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
