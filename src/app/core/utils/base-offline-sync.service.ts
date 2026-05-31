import { inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../feature/auth/auth.service';

export abstract class BaseOfflineSyncService<TAction> implements OnDestroy {
  protected http = inject(HttpClient);
  protected authService = inject(AuthService);

  protected abstract pingUrl: string;
  protected abstract queueKey: string;
  protected abstract syncQueue(): void | Promise<void>;

  private pingInterval: any;

  isOnline = signal<boolean>(navigator.onLine);
  isSyncing = signal<boolean>(false);

  constructor() {
    window.addEventListener('online', this.handleOnlineEvent);
    window.addEventListener('offline', this.handleOfflineEvent);

    this.pingInterval = setInterval(() => {
      if (!this.authService.isAuthenticated()) return;

      if (!this.isOnline() || this.getQueue().length > 0) {
        this.checkBackendStatus();
      }
    }, 10_000);

    setTimeout(() => this.checkBackendStatus(), 0);
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.handleOnlineEvent);
    window.removeEventListener('offline', this.handleOfflineEvent);
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
  }

  private handleOnlineEvent = () => this.checkBackendStatus();
  private handleOfflineEvent = () => this.isOnline.set(false);

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
