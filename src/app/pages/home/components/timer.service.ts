import {Injectable, signal, computed, WritableSignal, Signal} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  timeLeft: WritableSignal<number> = signal<number>(0);
  isRunning: WritableSignal<boolean> = signal<boolean>(false);

  private initialTime = 0;
  private endTime: number | null = null;
  private intervalId: number | null = null;
  private onFinishCallback: (() => void) | null = null;

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

  getInitialTime(): number {
    return this.initialTime;
  }

  getDurationUsed(): number {
    return this.initialTime - this.timeLeft();
  }

  setCallback(onFinish: () => void) {
    this.onFinishCallback = onFinish;
  }

  toggle() {
    if (this.timeLeft() > 0) {
      if (!this.isRunning()) {
        this.start();
      } else {
        this.pause();
      }
    }
  }

  private start() {
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
        if (this.onFinishCallback) {
          this.onFinishCallback();
        }
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
}
