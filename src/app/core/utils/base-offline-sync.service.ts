import { inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {AuthService} from '../../feature/auth/auth.service';

export abstract class BaseOfflineSyncService<TAction> {
  protected http = inject(HttpClient);
  protected authService = inject(AuthService);

  isOnline = signal<boolean>(navigator.onLine);
  isSyncing = signal<boolean>(false);

  protected abstract pingUrl: string;
  protected abstract queueKey: string;

  protected abstract syncQueue(): void | Promise<void>;

  constructor() {
    window.addEventListener('online', () => this.checkBackendStatus());
    window.addEventListener('offline', () => this.isOnline.set(false));

    setInterval(() => {
      if (!this.authService.isAuthenticated()) return;

      if (!this.isOnline() || this.getQueue().length > 0) {
        this.checkBackendStatus();
      }
    }, 10_000);

    setTimeout(() => this.checkBackendStatus(), 0);
  }

  protected getQueue(): TAction[] {
    return JSON.parse(localStorage.getItem(this.queueKey) || '[]');
  }

  protected setQueue(queue: TAction[]) {
    localStorage.setItem(this.queueKey, JSON.stringify(queue));
  }

  protected enqueueAction(action: Omit<TAction, 'id'>) {
    const queue = this.getQueue();
    queue.push({ ...action, id: crypto.randomUUID() } as TAction);
    this.setQueue(queue);
    this.syncQueue();

    if (this.authService.isAuthenticated()) {
      this.syncQueue();
    }
  }

  protected checkBackendStatus() {
    if (!navigator.onLine || !this.authService.isAuthenticated()) {
      this.isOnline.set(false);
      return;
    }

    this.http.get(this.pingUrl, { observe: 'response' }).subscribe({
      next: () => {
        if (!this.isOnline()) {
          this.isOnline.set(true);
          this.syncQueue();
        }
      },
      error: () => this.isOnline.set(false)
    });
  }
}
