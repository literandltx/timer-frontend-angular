import {Injectable, inject, OnDestroy, signal, Signal, WritableSignal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {timer, Subscription, of} from 'rxjs';
import {switchMap, catchError} from 'rxjs/operators';

interface PublicPingResponse {
  status: 'UP' | 'DOWN';
}

const POLLING_INITIAL_DELAY = 0;
const POLLING_INTERVAL_MS = 10_000;

@Injectable({
  providedIn: 'root'
})
export class HealthCheckService implements OnDestroy {
  private http: HttpClient = inject(HttpClient);
  private pollingSubscription: Subscription | undefined;

  private baseUrl: string = 'http://localhost:8080';

  private _isHealthy: WritableSignal<boolean> = signal<boolean>(false);
  public isHealthy: Signal<boolean> = this._isHealthy.asReadonly();

  constructor() {
    this.startHealthCheck();
  }

  updateBaseUrl(url: string) {
    this.stopHealthCheck();

    this.baseUrl = url;

    if (this.baseUrl) {
      this.startHealthCheck();
    } else {
      this._isHealthy.set(false);
    }
  }

  startHealthCheck() {
    if (this.pollingSubscription) {
      return;
    }

    if (!this.baseUrl) {
      return;
    }

    const healthUrl = `${this.baseUrl}/api/v1/system/ping/public`;

    this.pollingSubscription = timer(POLLING_INITIAL_DELAY, POLLING_INTERVAL_MS)
      .pipe(
        switchMap(() => {
          console.info(`[HealthCheckService] Pinging system...`);

          return this.http.get<PublicPingResponse>(healthUrl).pipe(
            catchError((error) => {
              console.error('[HealthCheckService] Ping failed or system is unreachable:', error);
              this._isHealthy.set(false);
              return of(null);
            })
          );
        })
      )
      .subscribe(response => {
        if (response) {
          const isUp = response.status === 'UP';
          this._isHealthy.set(isUp);
        }
      });
  }

  stopHealthCheck() {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
    }
  }

  ngOnDestroy() {
    this.stopHealthCheck();
  }
}
