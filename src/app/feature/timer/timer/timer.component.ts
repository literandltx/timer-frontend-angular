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
  selector: 'app-timer',
  standalone: true,
  templateUrl: './timer.component.html',
  styleUrls: ['./timer.component.css'],
  providers: [TimerService]
})
export class TimerComponent implements OnInit, OnDestroy, OnChanges {
  @Input({required: true}) timeAmount!: number;
  @Output() finish = new EventEmitter<{ durationUsed: number }>();
  @Output() reset = new EventEmitter<{ durationUsed: number }>();

  timerService = inject(TimerService);

  ngOnInit() {
    this.timerService.setInitialTime(this.timeAmount);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['timeAmount'] && !changes['timeAmount'].isFirstChange()) {
      this.handleDoubleClick();
      this.timerService.setInitialTime(this.timeAmount);
    }
  }

  ngOnDestroy() {
    this.timerService.destroy();
  }

  handleClick() {
    this.timerService.toggle(() => {
      this.finish.emit({durationUsed: this.timeAmount});
    });
  }

  handleDoubleClick() {
    const durationUsed = this.timerService.getDurationUsed();
    if (durationUsed > 0) {
      this.reset.emit({durationUsed});
    }
    this.timerService.reset(this.timeAmount);
  }
}
