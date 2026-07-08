import {HttpInterceptorFn, HttpErrorResponse} from '@angular/common/http';
import {inject} from '@angular/core';
import {AuthService} from '../auth/auth.service';
import {throwError, catchError, switchMap} from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();
  const isPublicAuthCall =
    req.url.includes('/api/v1/auth/login') ||
    req.url.includes('/api/v1/auth/register');
  const isRefreshCall = req.url.includes('/api/v1/auth/refresh');

  if (isPublicAuthCall) {
    return next(req);
  }

  const authReq = (token && !isRefreshCall)
    ? req.clone({setHeaders: {Authorization: `Bearer ${token}`}})
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !isRefreshCall) {
        return authService.refreshToken().pipe(
          switchMap((response) => {
            const retryReq = authReq.clone({
              setHeaders: {Authorization: `Bearer ${response.token}`}
            });
            return next(retryReq);
          }),
          catchError((refreshErr) => throwError(() => refreshErr))
        );
      }
      return throwError(() => error);
    })
  );
};
