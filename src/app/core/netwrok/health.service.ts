import {Injectable, inject, DestroyRef, signal, Signal, WritableSignal} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {Subscription, of, fromEvent, merge, Observable, timer} from 'rxjs';
import {switchMap, catchError, map, tap} from 'rxjs/operators';
import {environment} from '../../../environments/environment';
import {AuthService} from '../auth/auth.service';
import {LogService} from '../log/log.service';

interface PublicPingResponse {
  status: 'UP' | 'DOWN';
}

interface UserPingResponse {
  status: 'UP' | 'DOWN';
  user: string;
  activeDevices: number;
}

const SMART_POLL_INTERVAL_MS = 60_000;
const DEVICE_ID_KEY = 'app_device_uuid';

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  private authService = inject(AuthService);
  private log = inject(LogService);

  private smartPollingSubscription?: Subscription;
  private baseUrl: string | undefined = environment.base_url;
  private deviceUuid: string = this.getOrCreateDeviceUuid();

  private _isHealthy: WritableSignal<boolean> = signal<boolean>(false);
  public isHealthy: Signal<boolean> = this._isHealthy.asReadonly();

  private _isWsEnabled: WritableSignal<boolean> = signal<boolean>(false);
  public isWsEnabled: Signal<boolean> = this._isWsEnabled.asReadonly();

  constructor() {
    this.setupNativeNetworkListeners();
    this.doSinglePing();
  }

  public setWsStatus(enabled: boolean): void {
    if (this._isWsEnabled() !== enabled) {
      this._isWsEnabled.set(enabled);
      this.log.info(`[HealthCheckService] WebSocket status updated to: ${enabled ? 'ENABLED' : 'DISABLED'}`);

      if (!enabled && this._isHealthy() && this.authService.isAuthenticatedSignal()) {
        this.startSmartPolling();
      }
    }
  }

  public setOnlineStatus(isOnline: boolean): void {
    if (this._isHealthy() !== isOnline) {
      this._isHealthy.set(isOnline);
      this.log.info(`[HealthCheckService] Network status changed to: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    }

    if (isOnline && this.authService.isAuthenticatedSignal() && !this._isWsEnabled()) {
      this.startSmartPolling();
    } else if (!isOnline) {
      this.stopSmartPolling();
    }
  }

  private setupNativeNetworkListeners(): void {
    const networkStatus$ = merge(
      fromEvent(window, 'offline').pipe(map(() => false)),
      fromEvent(window, 'online').pipe(map(() => true))
    );

    const networkSub = networkStatus$.subscribe((isOnline) => {
      if (isOnline) {
        this.log.info('[HealthCheckService] OS reports online. Checking backend connection.');
        this.doSinglePing();
      } else {
        this.log.warn('[HealthCheckService] OS reports offline.');
        this.setOnlineStatus(false);
      }
    });

    this.destroyRef.onDestroy(() => {
      networkSub.unsubscribe();
      this.stopSmartPolling();
    });
  }

  private doSinglePing(): void {
    this.executePing().subscribe(isUp => {
      this.setOnlineStatus(isUp);
    });
  }

  private startSmartPolling(): void {
    if (this.smartPollingSubscription || !this.baseUrl) return;

    this.log.info('[HealthCheckService] Starting smart polling to detect 2nd device...');
    this.smartPollingSubscription = timer(0, SMART_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() => this.executePing())
      )
      .subscribe((isUp) => {
        if (!isUp) this.setOnlineStatus(false);
      });
  }

  private stopSmartPolling(): void {
    if (this.smartPollingSubscription) {
      this.log.info('[HealthCheckService] Stopping smart polling.');
      this.smartPollingSubscription.unsubscribe();
      this.smartPollingSubscription = undefined;
    }
  }

  private executePing(): Observable<boolean> {
    if (!this.baseUrl) {
      return of(false);
    }

    if (this.authService.isAuthenticatedSignal()) {
      const userUrl = `${this.baseUrl}/api/v1/system/ping/user`;
      const params = new HttpParams().set('deviceUuid', this.deviceUuid);
      return this.http.post<UserPingResponse>(userUrl, null, {params}).pipe(
        tap((response) => {
          const shouldEnableWs = response.activeDevices >= 2;
          this.setWsStatus(shouldEnableWs);
          if (shouldEnableWs) {
            this.stopSmartPolling();
          }
        }),
        map(response => response.status === 'UP'),
        catchError((error: HttpErrorResponse) => this.handlePingError(error))
      );
    } else {
      const publicUrl = `${this.baseUrl}/api/v1/system/ping/public`;
      this.log.info('[HealthCheckService] Public ping');
      return this.http.get<PublicPingResponse>(publicUrl).pipe(
        tap(() => this.setWsStatus(false)),
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
      this.log.warn('[HealthCheckService] Backend is unreachable. App is currently in offline mode.');
    } else {
      this.log.error(`[HealthCheckService] Backend returned error code ${error.status}`);
    }

    return of(false);
  }

}
