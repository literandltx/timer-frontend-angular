import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap, catchError, of, from, switchMap} from 'rxjs';
import {Router} from '@angular/router';
import {environment} from '../../../environments/environment';
import {AppDB} from '../db/app.db';
import {LogService} from '../log/log.service';
import {LoginCredentials, LoginResponse, RegisterData, RegisterResponse} from './auth.models';

export const SESSION_STORAGE_KEY = 'hasSession';

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
    return this.http.post<LoginResponse>(`${this.authApiUrl}/refresh`, {}, {withCredentials: true}).pipe(
      tap((response: LoginResponse) => {
        if (response?.token) {
          this.setToken(response.token);
        }
      })
    );
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

  getToken(): string | null {
    return this.accessToken;
  }

  public async resetLocalData(): Promise<void> {
    await this.performFullCleanup();
    window.location.reload();
  }

  public clearAuthState(): void {
    this.accessToken = null;
    this._isAuthenticated.set(false);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    this.accessToken = token;
    this._isAuthenticated.set(true);
    localStorage.setItem(SESSION_STORAGE_KEY, 'true');
  }

  private async performFullCleanup(): Promise<void> {
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
