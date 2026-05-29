import {Injectable, signal, computed, WritableSignal, Signal} from '@angular/core';

@Injectable()
export class TimerService {
  timeLeft: WritableSignal<number> = signal<number>(0);
  isRunning: WritableSignal<boolean> = signal<boolean>(false);

  private initialTime = 0;
  private endTime: number | null = null;
  private intervalId: number | null = null;

  formattedTime: Signal<string> = computed(() => {
    const total_second: number = this.timeLeft();
    const minute: string = Math.floor(total_second / 60).toString().padStart(2, '0');
    const second: string = (total_second % 60).toString().padStart(2, '0');
    return `${minute}:${second}`;
  });

  setInitialTime(time: number) {
    this.initialTime = time;
    this.timeLeft.set(time);
  }

  getDurationUsed(): number {
    return this.initialTime - this.timeLeft();
  }

  toggle(onFinish: () => void) {
    if (this.timeLeft() > 0) {
      if (!this.isRunning()) {
        this.start(onFinish);
      } else {
        this.pause();
      }
    }
  }

  private start(onFinish: () => void) {
    this.endTime = Date.now() + this.timeLeft() * 1000;
    this.isRunning.set(true);

    this.intervalId = window.setInterval(() => {
      if (!this.endTime) {
        return;
      }
      const remaining = Math.round((this.endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        this.pause();
        this.timeLeft.set(this.initialTime);
        onFinish();
      } else {
        this.timeLeft.set(remaining);
      }
    }, 500);
  }

  pause() {
    this.isRunning.set(false);
    this.endTime = null;
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  reset(newTime?: number) {
    this.pause();
    if (newTime !== undefined) {
      this.initialTime = newTime;
    }
    this.timeLeft.set(this.initialTime);
  }

  destroy() {
    this.pause();
  }
}
