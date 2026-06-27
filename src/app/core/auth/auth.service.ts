import {Injectable, inject, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, tap} from 'rxjs';
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

  public isAuthenticatedSignal = signal<boolean>(this.hasToken());

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
    localStorage.setItem('jwt_token', token);
    this.isAuthenticatedSignal.set(true);
  }

  getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  private hasToken(): boolean {
    return !!localStorage.getItem('jwt_token');
  }

  logout(): void {
    this.http.post(`${this.authApiUrl}/logout`, {}, {withCredentials: true}).subscribe({
      next: async () => await this.clearLocalState(),
      error: async (err) => {
        console.error('Server logout failed, but cleaning local state anyway', err);
        await this.clearLocalState();
      }
    });
  }

  deleteAccount(): void {
    this.http.delete(`${this.usersApiUrl}/me`, {withCredentials: true}).subscribe({
      next: async () => {
        console.log('Account deleted successfully');
        await this.clearLocalState();
      },
      error: (err) => {
        console.error('Account deletion failed', err);
        alert('Failed to delete account. Please try again later.');
      }
    });
  }

  private async clearLocalState(): Promise<void> {
    localStorage.removeItem('jwt_token');
    this.isAuthenticatedSignal.set(false);

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
    } catch (err) {
      console.error('Failed to clear IndexedDB on logout', err);
    }

    localStorage.clear();
    this.router.navigate(['/login']);
  }

}
