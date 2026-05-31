import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class TitleBlinkerService {
  private titleService = inject(Title);
  private blinkInterval: number | undefined;
  private originalTitle = '';

  startBlinking(message: string) {
    if (this.blinkInterval) return;

    this.originalTitle = this.titleService.getTitle();
    let isOriginal = false;

    this.blinkInterval = window.setInterval(() => {
      this.titleService.setTitle(isOriginal ? this.originalTitle : message);
      isOriginal = !isOriginal;
    }, 1000);
  }

  stopBlinking() {
    if (this.blinkInterval !== undefined) {
      window.clearInterval(this.blinkInterval);
      this.blinkInterval = undefined;
      this.titleService.setTitle(this.originalTitle);
    }
  }
}
