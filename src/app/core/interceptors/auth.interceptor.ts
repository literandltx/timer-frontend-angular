import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn
} from '@angular/common/http';
import {inject} from '@angular/core';
import {AuthService} from '../auth/auth.service';
import {Subject, throwError, catchError, switchMap, take} from 'rxjs';

let isRefreshing = false;
let refreshTokenSubject = new Subject<string>();

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const isPublicAuthCall =
    req.url.includes('/api/v1/auth/login') ||
    req.url.includes('/api/v1/auth/register');
  const isRefreshCall = req.url.includes('/api/v1/auth/refresh');

  let authReq = req;

  if (isPublicAuthCall) {
    return next(req);
  }

  if (token && !isRefreshCall) {
    authReq = req.clone({
      setHeaders: {Authorization: `Bearer ${token}`}
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isRefreshCall && (error.status === 401 || error.status === 403)) {
        authService.clearAuthState();
        return throwError(() => error);
      }

      if (error.status === 401 && !isRefreshCall) {
        return handle401Error(authReq, next, authService);
      }

      return throwError(() => error);
    })
  );
};

function handle401Error(req: HttpRequest<unknown>, next: HttpHandlerFn, authService: AuthService) {
  if (!isRefreshing) {
    isRefreshing = true;
    const currentSubject = refreshTokenSubject;

    return authService.refreshToken().pipe(
      switchMap((response) => {
        isRefreshing = false;
        currentSubject.next(response.token);
        currentSubject.complete();
        refreshTokenSubject = new Subject<string>();

        const newReq = req.clone({
          setHeaders: {Authorization: `Bearer ${response.token}`}
        });
        return next(newReq);
      }),
      catchError((err) => {
        isRefreshing = false;
        currentSubject.error(err);
        refreshTokenSubject = new Subject<string>();
        authService.clearAuthState();
        return throwError(() => err);
      })
    );
  }

  return refreshTokenSubject.pipe(
    take(1),
    switchMap((token) => {
      const newReq = req.clone({
        setHeaders: {Authorization: `Bearer ${token}`}
      });
      return next(newReq);
    })
  );
}
