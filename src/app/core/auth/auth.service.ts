import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap, catchError, finalize, of, from, switchMap, shareReplay} from 'rxjs';
import {Router} from '@angular/router';
import {environment} from '../../../environments/environment';
import {AppDB} from '../db/app.db';
import {LogService} from '../log/log.service';
import {LoginCredentials, LoginResponse, RegisterData, RegisterResponse} from './auth.models';
import {getJwtExpiryMs} from './auth-token.util';

export const SESSION_STORAGE_KEY = 'hasSession';

const REFRESH_BUFFER_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 5_000;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private db = inject(AppDB);
  private log = inject(LogService);

  private authApiUrl = `${environment.base_url}/api/v1/auth`;
  private usersApiUrl = `${environment.base_url}/api/v1/users`;
  private accessToken: string | null = null;

  private _isAuthenticated = signal<boolean>(false);
  public isAuthenticatedSignal = this._isAuthenticated.asReadonly();

  private refreshTimerId: ReturnType<typeof setTimeout> | null = null;
  private refreshInFlight: Observable<LoginResponse> | null = null;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.ensureSessionOnResume();
      }
    });
  }

  login(credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.authApiUrl}/login`, credentials, {withCredentials: true}).pipe(
      tap((response: LoginResponse) => {
        if (response?.token) {
          this.setToken(response.token);
        }
      })
    );
  }

  register(userData: RegisterData): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.authApiUrl}/register`, userData);
  }

  refreshToken(): Observable<LoginResponse> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const request$ = this.http.post<LoginResponse>(`${this.authApiUrl}/refresh`, {}, {withCredentials: true}).pipe(
      tap((response: LoginResponse) => {
        if (response?.token) {
          this.setToken(response.token);
        }
      }),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({bufferSize: 1, refCount: true})
    );

    this.refreshInFlight = request$;
    return request$;
  }

  logout(): Observable<unknown> {
    return this.http.post(`${this.authApiUrl}/logout`, {}, {withCredentials: true}).pipe(
      tap(() => this.clearAuthState()),
      catchError((err) => {
        this.log.error('Server logout failed, cleaning local state anyway', err);
        this.clearAuthState();
        return of(null);
      })
    );
  }

  deleteAccount(): Observable<unknown> {
    return this.http.delete(`${this.usersApiUrl}/me`, {withCredentials: true}).pipe(
      switchMap(() => from(this.performFullCleanup())),
      tap(() => {
        this.log.log('Account deleted successfully');
        window.location.href = '/login';
      })
    );
  }

  changeEmail(newEmail: string, password: string): Observable<unknown> {
    const payload = {newEmail, password};

    return this.http.post(
      `${this.usersApiUrl}/change/email`,
      payload,
      {withCredentials: true}
    )
  }

  changePassword(currentPassword: string, newPassword: string, confirmationPassword: string): Observable<unknown> {
    const payload = {currentPassword, newPassword, confirmationPassword}

    return this.http.post(
      `${this.usersApiUrl}/change/password`,
      payload,
      {withCredentials: true}
    )
  }

  getToken(): string | null {
    return this.accessToken;
  }

  async initSession(): Promise<void> {
    const hadSession = localStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    if (!hadSession) {
      return;
    }

    try {
      await this.refreshTokenPromise();
    } catch (err) {
      this.log.warn('[AuthService] Session restore on init failed, clearing local state.', err);
      this.clearAuthState();
    }
  }

  async resetLocalData(): Promise<void> {
    await this.performFullCleanup();
    window.location.reload();
  }

  clearAuthState(): void {
    this.clearRefreshTimer();
    this.accessToken = null;
    this._isAuthenticated.set(false);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  private ensureSessionOnResume(): void {
    const hadSession = localStorage.getItem(SESSION_STORAGE_KEY) === 'true';
    if (!hadSession) {
      return;
    }

    if (!this.accessToken) {
      this.log.info('[AuthService] Tab resumed with no in-memory token. Attempting silent session restore.');
      this.refreshTokenPromise().catch((err) => {
        this.log.warn('[AuthService] Silent session restore failed.', err);
        this.clearAuthState();
      });
      return;
    }

    const expiryMs = getJwtExpiryMs(this.accessToken);
    if (expiryMs !== null && expiryMs - Date.now() < REFRESH_BUFFER_MS) {
      this.log.info('[AuthService] Tab resumed with a stale/expiring token. Refreshing.');
      this.refreshTokenPromise().catch((err) => {
        this.log.warn('[AuthService] Refresh on resume failed.', err);
        this.clearAuthState();
      });
    }
  }

  private refreshTokenPromise(): Promise<LoginResponse> {
    return new Promise((resolve, reject) => {
      this.refreshToken().subscribe({
        next: (response) => resolve(response),
        error: (err) => reject(err)
      });
    });
  }

  private setToken(token: string): void {
    this.accessToken = token;
    this._isAuthenticated.set(true);
    localStorage.setItem(SESSION_STORAGE_KEY, 'true');
    this.scheduleProactiveRefresh(token);
  }

  private scheduleProactiveRefresh(token: string): void {
    this.clearRefreshTimer();

    const expiryMs = getJwtExpiryMs(token);
    if (expiryMs === null) {
      this.log.warn('[AuthService] Could not read token expiry; proactive refresh disabled for this token.');
      return;
    }

    const delay = Math.max(expiryMs - Date.now() - REFRESH_BUFFER_MS, MIN_REFRESH_DELAY_MS);

    this.refreshTimerId = setTimeout(() => {
      if (!this._isAuthenticated()) {
        return;
      }

      this.log.info('[AuthService] Proactively refreshing access token before expiry.');
      this.refreshToken().subscribe({
        error: (err) => this.log.warn('[AuthService] Proactive refresh failed.', err)
      });
    }, delay);
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimerId !== null) {
      clearTimeout(this.refreshTimerId);
      this.refreshTimerId = null;
    }
  }

  private async performFullCleanup(): Promise<void> {
    this.clearRefreshTimer();
    this.accessToken = null;
    this._isAuthenticated.set(false);
    localStorage.clear();

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
      this.log.log('IndexedDB cleared successfully');
    } catch (err) {
      this.log.error('Failed to clear IndexedDB', err);
    }
  }
}
