import {HttpErrorResponse} from '@angular/common/http';

export function mapAuthError(err: HttpErrorResponse, context: 'login' | 'register'): string {
  if (err.status === 0 || err.status >= 500) {
    return context === 'login'
      ? 'Servers are currently offline. Cannot log in right now.'
      : 'Servers are currently offline. Cannot register right now.';
  }

  return context === 'login'
    ? 'Invalid email or password.'
    : 'Registration failed. Please check your details and try again.';
}
