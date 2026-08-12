import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn
} from '@angular/common/http';
import {inject} from '@angular/core';
import {Router} from '@angular/router';
import {AuthService} from '../auth/auth.service';
import {BehaviorSubject, throwError, catchError, filter, switchMap, take} from 'rxjs';

const REFRESH_FAILED = Symbol('refresh-failed');
type RefreshState = string | null | typeof REFRESH_FAILED;

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<RefreshState>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  if (
    req.url.includes('/api/v1/auth/login') ||
    req.url.includes('/api/v1/auth/register') ||
    req.url.includes('/api/v1/auth/refresh')
  ) {
    return next(req);
  }

  let authReq = req;
  if (token) {
    authReq = req.clone({
      setHeaders: {Authorization: `Bearer ${token}`}
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/api/v1/auth/refresh')) {
        return handle401Error(authReq, next, authService);
      }

      if ((error.status === 401 || error.status === 403) && req.url.includes('/api/v1/auth/refresh')) {
        authService.logout();
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};

function handle401Error(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshTokenSubject.next(null);

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        refreshTokenSubject.next(response.token);

        const newReq = req.clone({
          setHeaders: {Authorization: `Bearer ${response.token}`}
        });
        return next(newReq);
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshTokenSubject.next(REFRESH_FAILED);
        authService.clearAuthState();
        return throwError(() => err);
      })
    );
  } else {
    return refreshTokenSubject.pipe(
      filter((token): token is string | typeof REFRESH_FAILED => token !== null),
      take(1),
      switchMap((token) => {
        if (token === REFRESH_FAILED) {
          return throwError(() => new HttpErrorResponse({status: 401}));
        }
        const newReq = req.clone({
          setHeaders: {Authorization: `Bearer ${token}`}
        });
        return next(newReq);
      })
    );
  }
}
