import {inject, signal, OnDestroy, Injectable, PLATFORM_ID} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {HttpClient} from '@angular/common/http';
import {Subscription} from 'rxjs';
import {AuthService} from '../../feature/auth/auth.service';

@Injectable()
export abstract class BaseOfflineSyncService<TAction> implements OnDestroy {
  protected http = inject(HttpClient);
  protected authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  protected abstract pingUrl: string;
  protected abstract queueKey: string;

  protected abstract syncQueue(): void | Promise<void>;

  private pingInterval?: ReturnType<typeof setInterval>;
  private pingSubscription?: Subscription;

  isOnline = signal<boolean>(false);
  isSyncing = signal<boolean>(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline.set(navigator.onLine);
      window.addEventListener('online', this.handleOnlineEvent);
      window.addEventListener('offline', this.handleOfflineEvent);

      this.pingInterval = setInterval(() => {
        if (!this.authService.isAuthenticated()) return;

        if (!this.isOnline() || this.getQueue().length > 0) {
          this.checkBackendStatus();
        }
      }, 10_000);

      setTimeout(() => this.checkBackendStatus(), 0);
    } else {
      this.isOnline.set(true);
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('online', this.handleOnlineEvent);
      window.removeEventListener('offline', this.handleOfflineEvent);
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
      }
    }
    this.pingSubscription?.unsubscribe();
  }

  private handleOnlineEvent = () => this.checkBackendStatus();
  private handleOfflineEvent = () => this.isOnline.set(false);

  protected getQueue(): TAction[] {
    if (!isPlatformBrowser(this.platformId)) return [];

    try {
      const stored = localStorage.getItem(this.queueKey);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Failed to parse offline queue. Clearing corrupted data.');
      localStorage.removeItem(this.queueKey);
      return [];
    }
  }

  protected setQueue(queue: TAction[]) {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.queueKey, JSON.stringify(queue));
    }
  }

  protected enqueueAction(action: Omit<TAction, 'id'>) {
    const queue = this.getQueue();
    queue.push({...action, id: crypto.randomUUID()} as TAction);
    this.setQueue(queue);

    if (this.authService.isAuthenticated()) {
      this.triggerSync();
    }
  }

  protected async triggerSync() {
    if (this.isSyncing() || this.getQueue().length === 0) return;

    this.isSyncing.set(true);
    try {
      await this.syncQueue();
    } catch (error) {
      console.error('Offline sync failed', error);
    } finally {
      this.isSyncing.set(false);
    }
  }

  protected checkBackendStatus() {
    if (!isPlatformBrowser(this.platformId) || !navigator.onLine || !this.authService.isAuthenticated()) {
      this.isOnline.set(false);
      return;
    }

    if (this.pingSubscription && !this.pingSubscription.closed) {
      return;
    }

    this.pingSubscription = this.http.get(this.pingUrl, {observe: 'response'}).subscribe({
      next: () => {
        if (!this.isOnline()) {
          this.isOnline.set(true);
        }
        this.triggerSync();
      },
      error: () => this.isOnline.set(false)
    });
  }
}
