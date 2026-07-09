import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap, catchError, of} from 'rxjs';
import {Router} from '@angular/router';
import {environment} from '../../../environments/environment';
import {AppDB} from '../db/app.db';
import {LogService} from '../log/log.service';
import {LoginCredentials, LoginResponse, RegisterData, RegisterResponse} from './auth.models';

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

  private _isAuthenticated = signal<boolean>(false);
  public isAuthenticatedSignal = this._isAuthenticated.asReadonly();

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
    return this.http.post<LoginResponse>(`${this.authApiUrl}/refresh`, {}, {withCredentials: true}).pipe(
      tap((response: LoginResponse) => {
        if (response && response.token) {
          this.setToken(response.token);
        }
      })
    );
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

  getToken(): string | null {
    return this.accessToken;
  }

  public async resetLocalData(): Promise<void> {
    this.accessToken = null;
    this._isAuthenticated.set(false);

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
      this.log.log('IndexedDB cleared successfully');
    } catch (err) {
      this.log.error('Failed to clear IndexedDB during reset', err);
    }

    localStorage.clear();
    window.location.reload();
  }

  private setToken(token: string): void {
    this.accessToken = token;
    this._isAuthenticated.set(true);
    localStorage.setItem('hasSession', 'true');
  }

  public clearAuthState(): void {
    this.accessToken = null;
    this._isAuthenticated.set(false);
    localStorage.removeItem('hasSession');
    this.router.navigate(['/login']);
  }

  private async clearAllUserData(): Promise<void> {
    this.accessToken = null;
    this._isAuthenticated.set(false);

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
    } catch (err) {
      this.log.error('Failed to clear IndexedDB on account deletion', err);
    }

    localStorage.clear();
    window.location.href = '/login';
  }

}
