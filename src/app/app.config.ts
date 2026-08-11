import {ApplicationConfig, ErrorHandler, provideAppInitializer, inject} from '@angular/core';
import {provideRouter, withViewTransitions} from '@angular/router';
import {provideHttpClient, withInterceptors, withXhr} from '@angular/common/http';
import {routes} from './app.routes';
import {authInterceptor} from './core/interceptors/auth.interceptor';
import {networkStatusInterceptor} from './core/interceptors/network-status.interceptor';
import {GlobalErrorHandler} from './core/errors/global-error-handler';
import {DatabaseInitializer} from './core/services/db/database-initializer.service';
import {AuthService} from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withViewTransitions()),

    provideHttpClient(withXhr(),
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
      return authService.initSession();
    })
  ]
};
