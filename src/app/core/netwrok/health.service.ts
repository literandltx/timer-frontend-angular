import {Injectable, inject, DestroyRef, signal, Signal, WritableSignal} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {timer, Subscription, of, fromEvent, merge, Observable} from 'rxjs';
import {switchMap, catchError, map, tap} from 'rxjs/operators';
import {environment} from '../../../environments/environment';
import {AuthService} from '../auth/auth.service';

interface PublicPingResponse {
  status: 'UP' | 'DOWN';
}

interface UserPingResponse {
  status: 'UP' | 'DOWN';
  user: string;
  activeDevices: number;
}

const POLLING_INITIAL_DELAY = 0;
const POLLING_INTERVAL_MS = 10_000;
const DEVICE_ID_KEY = 'app_device_uuid';

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);

  private pollingSubscription?: Subscription;
  private baseUrl: string | undefined = environment.base_url;
  private deviceUuid: string = this.getOrCreateDeviceUuid();

  private _isHealthy: WritableSignal<boolean> = signal<boolean>(false);
  public isHealthy: Signal<boolean> = this._isHealthy.asReadonly();

  private _isWsEnabled: WritableSignal<boolean> = signal<boolean>(true);
  public isWsEnabled: Signal<boolean> = this._isWsEnabled.asReadonly();

  constructor() {
    this.setupNativeNetworkListeners();
    this.startHealthCheck();
  }

  public setWsStatus(enabled: boolean): void {
    this._isWsEnabled.set(enabled);
    console.info(`[HealthCheckService] WebSocket status updated to: ${enabled ? 'ENABLED' : 'DISABLED'}`);
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

    this.pollingSubscription = timer(POLLING_INITIAL_DELAY, POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() => this.executePing())
      )
      .subscribe((isUp) => this._isHealthy.set(isUp));
  }

  stopHealthCheck(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  private executePing(): Observable<boolean> {
    if (this.authService.isAuthenticatedSignal()) {
      const userUrl = `${this.baseUrl}/api/v1/system/ping/user`;
      const params = new HttpParams().set('deviceUuid', this.deviceUuid);
      return this.http.post<UserPingResponse>(userUrl, null, {params}).pipe(
        tap((response) => {
          console.info(`[HealthCheckService] User ping. Active devices count: ${response.activeDevices}`);
          const shouldEnableWs = response.activeDevices >= 2;
          if (this._isWsEnabled() !== shouldEnableWs) {
            this.setWsStatus(shouldEnableWs);
          }
        }),
        map(response => response.status === 'UP'),
        catchError((error: HttpErrorResponse) => this.handlePingError(error))
      );
    } else {
      const publicUrl = `${this.baseUrl}/api/v1/system/ping/public`;
      console.info('[HealthCheckService] Public ping');
      return this.http.get<PublicPingResponse>(publicUrl).pipe(
        tap(() => {
          if (this._isWsEnabled()) {
            this.setWsStatus(false);
          }
        }),
        map(response => response.status === 'UP'),
        catchError((error: HttpErrorResponse) => this.handlePingError(error))
      );
    }
  }

  private getOrCreateDeviceUuid(): string {
    let uuid = localStorage.getItem(DEVICE_ID_KEY);
    if (!uuid) {
      uuid = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, uuid);
    }
    return uuid;
  }

  private handlePingError(error: HttpErrorResponse): Observable<boolean> {
    if (error.status === 0) {
      console.warn('[HealthCheckService] Backend is unreachable. App is currently in offline mode.');
    } else {
      console.error(`[HealthCheckService] Backend returned error code ${error.status}`);
    }

    return of(false);
  }

}
