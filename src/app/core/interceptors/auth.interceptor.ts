import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import {AuthService} from '../../shared/services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  if (req.url.includes('/api/v1/auth/login') || req.url.includes('/api/v1/auth/register')) {
    return next(req);
  }

  if (token) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next(authReq);
  }

  return next(req);
};
