import { Injectable } from '@angular/core';
import { RxStomp } from '@stomp/rx-stomp';
import { Observable, tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class WebSocketCoreService {
  private rxStomp = new RxStomp();

  public connect(url: string, jwtToken: string) {
    if (!url || !jwtToken) {
      console.warn('[WebSocketCoreService] Connection aborted: URL or JWT Token is missing.');
      return;
    }

    const wsUrl = url.replace(/^http/, 'ws') + '/ws-stomp';
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

  public watch(destination: string): Observable<any> {
    console.info(`[WebSocketCoreService] Subscribing to destination: ${destination}`);

    return this.rxStomp.watch(destination).pipe(
      tap((message) => {
        console.log(`[WebSocketCoreService] Message received on ${destination}:`, message.body);
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
