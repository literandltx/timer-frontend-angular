import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {AuthService} from '../../core/auth/auth.service';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';
import {AppDB} from '../../core/db/app.db';

@Component({
  selector: 'ns-app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private db = inject(AppDB);

  isLoading = signal(false);
  errorMessage = signal('');

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const {email, password} = this.loginForm.getRawValue();

      this.authService.login({username: email, password}).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/home']);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);

          if (err.status === 0 || err.status >= 500) {
            this.errorMessage.set('Servers are currently offline. Cannot log in right now.');
          } else {
            this.errorMessage.set('Invalid email or password.');
          }
        }
      });
    }
  }

  async onLogout() {
    this.authService.logout();
    localStorage.clear();

    try {
      await Promise.all(this.db.tables.map(table => table.clear()));
    } catch (err) {
      console.error('Failed to clear IndexedDB on logout', err);
    }

    this.loginForm.reset();
  }
}
