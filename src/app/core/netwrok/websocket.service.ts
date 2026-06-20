import { Injectable, inject, effect } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, map, catchError, EMPTY } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { HealthCheckService } from '../netwrok/health.service';

@Injectable({
  providedIn: 'root'
})
export class WebSocketCoreService {
  private authService = inject(AuthService);
  private healthService = inject(HealthCheckService);

  private rxStomp = new RxStomp();
  private isActivated = false;
  private API_URL = `${environment.base_url}`;

  constructor() {
    effect(() => {
      const isAuth = this.authService.isAuthenticatedSignal();
      const isHealthy = this.healthService.isHealthy();

      if (isAuth && isHealthy) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  public get onConnected$(): Observable<number> {
    return this.rxStomp.connected$;
  }

  private connect(): void {
    if (this.isActivated) {
      return;
    }

    const jwtToken = this.authService.getToken();
    if (!jwtToken) {
      return;
    }

    const wsUrl = this.API_URL.replace(/^http(s)?:\/\//, 'ws$1://') + '/ws-stomp';
    console.info(`[WebSocketCoreService] Initiating connection to: ${wsUrl}`);

    this.rxStomp.configure({
      brokerURL: wsUrl,
      connectHeaders: { Authorization: `Bearer ${jwtToken}` },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (msg: string): void => {
        console.log(new Date().toISOString(), '[RxStomp Debug]', msg);
      }
    });

    this.rxStomp.activate();
    this.isActivated = true;
    console.info('[WebSocketCoreService] RxStomp activated.');
  }

  public disconnect() {
    if (!this.isActivated) {
      return;
    }

    console.info('[WebSocketCoreService] Disconnecting from WebSocket...');
    this.rxStomp.deactivate();
    this.isActivated = false;
  }

  public watch<T>(destination: string): Observable<T> {
    console.info(`[WebSocketCoreService] Subscribing to: ${destination}`);

    return this.rxStomp.watch(destination).pipe(
      map(message => {
        try {
          return JSON.parse(message.body) as T;
        } catch {
          return message.body as unknown as T;
        }
      }),
      catchError(err => {
        console.error(`[WebSocketCoreService] Error on ${destination}`, err);
        return EMPTY;
      })
    );
  }

  public publish(destination: string, body: any): void {
    console.info(`[WebSocketCoreService] Publishing message to: ${destination}`, body);

    this.rxStomp.publish({
      destination,
      body: JSON.stringify(body)
    });
  }

}
