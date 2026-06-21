import {Injectable, inject, DestroyRef, signal, Signal, WritableSignal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {timer, Subscription, of, fromEvent, merge} from 'rxjs';
import {switchMap, catchError, map} from 'rxjs/operators';
import {environment} from '../../../environments/environment';

interface PublicPingResponse {
  status: 'UP' | 'DOWN';
}

const POLLING_INITIAL_DELAY = 0;
const POLLING_INTERVAL_MS = 10_000;

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef); // Modern auto-cleanup

  private pollingSubscription?: Subscription;
  private baseUrl: string | undefined = environment.base_url;

  private _isHealthy: WritableSignal<boolean> = signal<boolean>(false);
  public isHealthy: Signal<boolean> = this._isHealthy.asReadonly();

  constructor() {
    this.setupNativeNetworkListeners();
    this.startHealthCheck();
  }

  private setupNativeNetworkListeners(): void {
    const networkStatus$ = merge(
      fromEvent(window, 'offline').pipe(map(() => false)),
      fromEvent(window, 'online').pipe(map(() => true))
    );

    const networkSub = networkStatus$.subscribe((isOnline) => {
      if (isOnline) {
        console.info('[HealthCheckService] OS reports online. Resuming health checks.');
        this.startHealthCheck();
      } else {
        console.warn('[HealthCheckService] OS reports offline. Pausing health checks.');
        this._isHealthy.set(false);
        this.stopHealthCheck();
      }
    });

    this.destroyRef.onDestroy(() => {
      networkSub.unsubscribe();
      this.stopHealthCheck();
    });
  }

  startHealthCheck(): void {
    if (this.pollingSubscription || !this.baseUrl) return;

    const healthUrl = `${this.baseUrl}/api/v1/system/ping/public`;

    this.pollingSubscription = timer(POLLING_INITIAL_DELAY, POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.http.get<PublicPingResponse>(healthUrl).pipe(
            map(response => response.status === 'UP'),
            catchError((error) => {
              console.error('[HealthCheckService] Ping failed:', error);
              return of(false);
            })
          )
        )
      )
      .subscribe((isUp) => this._isHealthy.set(isUp));
  }

  stopHealthCheck(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }
}
