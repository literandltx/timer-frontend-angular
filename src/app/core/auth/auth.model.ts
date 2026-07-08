export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  repeatPassword: string;
}

export interface LoginResponse {
  token: string;
}

export interface RegisterResponse {
  id: number;
  email: string;
}
