import {ApplicationConfig, ErrorHandler, provideAppInitializer, inject} from '@angular/core';
import {provideRouter, withViewTransitions} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {catchError, of, switchMap, tap} from 'rxjs';
import {routes} from './app.routes';
import {authInterceptor} from './core/interceptors/auth.interceptor';
import {networkStatusInterceptor} from './core/interceptors/network-status.interceptor';
import {GlobalErrorHandler} from './core/errors/global-error-handler';
import {DatabaseInitializer} from './core/services/db/database-initializer.service';
import {AuthService} from './core/auth/auth.service';
import {HealthCheckService} from './core/netwrok/health.service';
import {map} from 'rxjs/operators';

// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),

    provideHttpClient(
      withInterceptors([authInterceptor, networkStatusInterceptor])
    ),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    provideAppInitializer(() => {
      const seeder = inject(DatabaseInitializer);
      return seeder.seedInitialData();
    }),
    provideAppInitializer(() => {
      const authService = inject(AuthService);

      if (localStorage.getItem('hasSession') === 'true') {
        return authService.refreshToken().pipe(
          catchError(() => {
            authService.clearAuthState();
            return of(null);
          })
        );
      }

      return of(null);
    })
  ]
};
