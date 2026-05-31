import {Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {Router, RouterLink} from '@angular/router';
import {AuthService} from '../auth.service';
import {CommonModule} from '@angular/common';
import {HttpErrorResponse} from '@angular/common/http';

@Component({
  selector: 'ns-app-register',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(false);
  errorMessage = signal('');

  registerForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      const {email, password} = this.registerForm.getRawValue();

      const payload = {
        email,
        password,
        repeatPassword: password
      };

      this.authService.register(payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate(['/login']);
        },
        error: (err: HttpErrorResponse) => {
          this.isLoading.set(false);

          if (err.status === 0 || err.status >= 500) {
            this.errorMessage.set('Servers are currently offline. Cannot register right now.');
          } else {
            this.errorMessage.set('Registration failed. Please check your details and try again.');
          }

          console.error(err);
        }
      });
    }
  }
}
