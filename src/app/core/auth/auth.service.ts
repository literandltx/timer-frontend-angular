import {Injectable, inject, signal} from '@angular/core';
import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Observable, tap, catchError, of, throwError, finalize, shareReplay} from 'rxjs';
import {Router} from '@angular/router';
import {environment} from '../../../environments/environment';
import {AppDB} from '../db/app.db';
import {LogService} from '../log/log.service';
import {LoginCredentials, LoginResponse, RegisterData, RegisterResponse} from './auth.model';

const REFRESH_BUFFER_MS = 60_000;
const FALLBACK_REFRESH_MS = 13 * 60_000;
const MIN_RETRY_DELAY_MS = 5_000;
const MAX_RETRY_DELAY_MS = 30_000;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http: HttpClient = inject(HttpClient);
  private router: Router = inject(Router);
  private db: AppDB = inject(AppDB);
  private log: LogService = inject(LogService);

  private authApiUrl = `${environment.base_url}/api/v1/auth`;
  private usersApiUrl = `${environment.base_url}/api/v1/users`;
  private accessToken: string | null = null;

  private refreshTimerId?: ReturnType<typeof setTimeout>;
  private retryDelayMs = MIN_RETRY_DELAY_MS;
  private refreshInProgress$: Observable<LoginResponse> | null = null;

  private _isAuthenticated = signal<boolean>(false);
  public isAuthenticatedSignal = this._isAuthenticated.asReadonly();

  constructor() {
    this.refreshToken().subscribe({
      error: () => this.log.info('[AuthService] No active session to restore on startup.')
    });
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authApiUrl}/login`, credentials, {withCredentials: true}).pipe(
      tap((response: LoginResponse) => {
        if (response && response.token) {
          this.setToken(response.token);
        }
      })
    );
  }

  register(userData: RegisterData): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.authApiUrl}/register`, userData);
  }

  refreshToken(): Observable<LoginResponse> {
    if (this.refreshInProgress$) {
      return this.refreshInProgress$;
    }

    const request$ = this.http.post<LoginResponse>(`${this.authApiUrl}/refresh`, {}, {withCredentials: true}).pipe(
      tap((response: LoginResponse) => {
        if (response && response.token) {
          this.setToken(response.token);
        }
      }),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 401 || err.status === 403) {
          this.log.warn('[AuthService] Refresh token invalid or expired. Logging out.');
          this.clearAuthState();
        }
        return throwError(() => err);
      }),
      finalize(() => {
        this.refreshInProgress$ = null;
      }),
      shareReplay({bufferSize: 1, refCount: false})
    );

    this.refreshInProgress$ = request$;
    return request$;
  }

  logout(): Observable<unknown> {
    return this.http.post(`${this.authApiUrl}/logout`, {}, {withCredentials: true}).pipe(
      tap(() => this.clearAuthState()),
      catchError((err) => {
        this.log.error('Server logout failed, but cleaning local auth state anyway', err);
        this.clearAuthState();
        return of(null);
      })
    );
  }

  deleteAccount(): void {
    this.http.delete(`${this.usersApiUrl}/me`, {withCredentials: true}).subscribe({
      next: async () => {
        this.log.log('Account deleted successfully');
        await this.clearAllUserData();
      },
      error: (err) => {
        this.log.error('Account deletion failed', err);
        alert('Failed to delete account. Please try again later.');
      }
    });
  }

  private setToken(token: string): void {
    this.accessToken = token;
    this._isAuthenticated.set(true);
    this.retryDelayMs = MIN_RETRY_DELAY_MS;
    this.scheduleProactiveRefresh(token);
  }

  getToken(): string | null {
    return this.accessToken;
  }

  private scheduleProactiveRefresh(token: string): void {
    this.clearRefreshTimer();

    const expiresAt = AuthService.decodeJwtExpiry(token);
    const delay = expiresAt
      ? Math.max(expiresAt - Date.now() - REFRESH_BUFFER_MS, 0)
      : FALLBACK_REFRESH_MS;

    this.refreshTimerId = setTimeout(() => this.attemptProactiveRefresh(), delay);
  }

  private attemptProactiveRefresh(): void {
    this.refreshToken().subscribe({
      error: (err: HttpErrorResponse) => {
        if (err.status !== 401 && err.status !== 403) {
          this.log.warn(`[AuthService] Proactive refresh failed (status ${err.status}). Retry in ${this.retryDelayMs}ms`);
          this.refreshTimerId = setTimeout(() => this.attemptProactiveRefresh(), this.retryDelayMs);
          this.retryDelayMs = Math.min(this.retryDelayMs * 2, MAX_RETRY_DELAY_MS);
        }
      }
    });
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = undefined;
    }
  }

  private static decodeJwtExpiry(token: string): number | null {
    try {
      const payloadBase64 = token.split('.')[1];
      const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
      const payload = JSON.parse(payloadJson) as {exp?: number};
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  private async clearSession(options: {clearStorage?: boolean; redirectHref?: string} = {}): Promise<void> {
    this.clearRefreshTimer();
    this.accessToken = null;
    this._isAuthenticated.set(false);

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
      this.log.log('IndexedDB cleared successfully');
    } catch (err) {
      this.log.error('Failed to clear IndexedDB', err);
    }

    if (options.clearStorage) {
      localStorage.clear();
    }

    if (options.redirectHref) {
      window.location.href = options.redirectHref;
    } else {
      this.router.navigate(['/login']);
    }
  }

  public async resetLocalData(): Promise<void> {
    await this.clearSession({clearStorage: true});
    window.location.reload();
  }

  public clearAuthState(): void {
    this.clearSession();
  }

  private async clearAllUserData(): Promise<void> {
    await this.clearSession({clearStorage: true, redirectHref: '/login'});
  }

}
