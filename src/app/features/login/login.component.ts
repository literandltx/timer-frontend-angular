import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {AuthService} from '../../core/service/auth.service';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';

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
          this.router.navigate(['/dashboard']);
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

  onLogout() {
    this.authService.logout();
    localStorage.clear();
    this.loginForm.reset();

    console.log('User logged out successfully');
  }
}
