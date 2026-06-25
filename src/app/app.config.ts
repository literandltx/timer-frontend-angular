import {ApplicationConfig, ErrorHandler, provideAppInitializer, inject} from '@angular/core';
import {provideRouter} from '@angular/router';
import {provideHttpClient, withInterceptors} from '@angular/common/http';
import {routes} from './app.routes';
import {authInterceptor} from './core/interceptors/auth.interceptor';
import {GlobalErrorHandler} from './core/errors/global-error-handler';
import {DatabaseInitializer} from './core/services/database-initializer.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])
    ),
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler
    },
    provideAppInitializer(() => {
      const seeder = inject(DatabaseInitializer);
      return seeder.seedInitialData();
    })
  ]
};
