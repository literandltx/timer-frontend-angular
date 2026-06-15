import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, tap, map, catchError, EMPTY, shareReplay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebSocketCoreService {
  private rxStomp = new RxStomp();

  public get onConnected$(): Observable<number> {
    return this.rxStomp.connected$;
  }

  public connect(apiUrl: string, jwtToken: string) {
    if (!apiUrl) {
      console.warn('[WebSocketCoreService] Connection aborted: URL is missing.');
      return;
    }

    if (!jwtToken) {
      console.warn('[WebSocketCoreService] Connection aborted: JWT Token is missing.');
      return;
    }

    const wsUrl = apiUrl.replace(/^http(s)?:\/\//, 'ws$1://') + '/ws-stomp';
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
    console.info('[WebSocketCoreService] RxStomp activated.');
  }

  public disconnect() {
    console.info('[WebSocketCoreService] Disconnecting from WebSocket...');
    this.rxStomp.deactivate();
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
      }),
      shareReplay({ bufferSize: 1, refCount: true })
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
