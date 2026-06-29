import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';
import { HealthCheckService } from '../netwrok/health.service';

export const networkStatusInterceptor: HttpInterceptorFn = (req, next) => {
  const healthService = inject(HealthCheckService);

  return next(req).pipe(
    tap({
      next: () => {
        healthService.setOnlineStatus(true);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 0) {
          healthService.setOnlineStatus(false);
        } else {
          healthService.setOnlineStatus(true);
        }
      }
    })
  );
};
