import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap, catchError, of} from 'rxjs';
import {Router} from '@angular/router';
import {environment} from '../../../environments/environment';
import {AppDB} from '../db/app.db';

export interface LoginCredentials {
  email?: string;
  username?: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  token: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http: HttpClient = inject(HttpClient);
  private router: Router = inject(Router);
  private db: AppDB = inject(AppDB);

  private authApiUrl = `${environment.base_url}/api/v1/auth`;
  private usersApiUrl = `${environment.base_url}/api/v1/users`;
  private accessToken: string | null = null;

  private _isAuthenticated = signal<boolean>(false);
  public isAuthenticatedSignal = this._isAuthenticated.asReadonly();

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authApiUrl}/login`, credentials, {withCredentials: true}).pipe(
      tap((response: AuthResponse) => {
        if (response && response.token) {
          this.setToken(response.token);
        }
      })
    );
  }

  register(userData: RegisterData): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authApiUrl}/register`, userData);
  }

  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.authApiUrl}/refresh`, {}, {withCredentials: true}).pipe(
      tap((response: AuthResponse) => {
        if (response && response.token) {
          this.setToken(response.token);
        }
      })
    );
  }

  private setToken(token: string): void {
    this.accessToken = token;
    this._isAuthenticated.set(true);
  }

  getToken(): string | null {
    return this.accessToken;
  }

  logout(): Observable<any> {
    return this.http.post(`${this.authApiUrl}/logout`, {}, {withCredentials: true}).pipe(
      tap(() => this.clearAuthState()),
      catchError((err) => {
        console.error('Server logout failed, but cleaning local auth state anyway', err);
        this.clearAuthState();
        return of(null);
      })
    );
  }

  deleteAccount(): void {
    this.http.delete(`${this.usersApiUrl}/me`, {withCredentials: true}).subscribe({
      next: async () => {
        console.log('Account deleted successfully');
        await this.clearAllUserData();
      },
      error: (err) => {
        console.error('Account deletion failed', err);
        alert('Failed to delete account. Please try again later.');
      }
    });
  }

  public clearAuthState(): void {
    this.accessToken = null;
    this._isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  private async clearAllUserData(): Promise<void> {
    this.accessToken = null;
    this._isAuthenticated.set(false);

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
    } catch (err) {
      console.error('Failed to clear IndexedDB on account deletion', err);
    }

    localStorage.clear();
    window.location.href = '/login';
  }

}
