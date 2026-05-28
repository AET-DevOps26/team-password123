export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResponse {
  tokenType: string;
  accessToken: string;
  expiresAt: string;
  userId: string;
  email: string;
  displayName: string;
}
