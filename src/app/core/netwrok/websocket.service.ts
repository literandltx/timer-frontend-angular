import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, map, catchError, EMPTY, shareReplay } from 'rxjs';
import {environment} from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class WebSocketCoreService {
  private rxStomp = new RxStomp();
  private isActivated = false;
  private API_URL = `${environment.base_url}`;

  public get onConnected$(): Observable<number> {
    return this.rxStomp.connected$;
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
    this.ensureConnection();
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
    this.ensureConnection();
    console.info(`[WebSocketCoreService] Publishing message to: ${destination}`, body);

    this.rxStomp.publish({
      destination,
      body: JSON.stringify(body)
    });
  }

  private ensureConnection(): void {
    if (this.isActivated) {
      return;
    }

    const jwtToken = localStorage.getItem('jwt_token');

    if (!jwtToken) {
      console.warn('[WebSocketCoreService] Connection aborted: JWT Token is missing.');
      return;
    }

    const wsUrl = this.API_URL.replace(/^http(s)?:\/\//, 'ws$1://') + '/ws-stomp';
    console.info(`[WebSocketCoreService] Lazily initiating connection to: ${wsUrl}`);

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

}
