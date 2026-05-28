import { apiClient } from '../../../api/client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../model/types';
import type { UserResponse } from '../../../entities/user';

export const authApi = {
  login: (body: LoginRequest): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>('/auth/login', body),

  register: (body: RegisterRequest): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>('/auth/register', body),

  me: (): Promise<UserResponse> =>
    apiClient.get<UserResponse>('/users/me'),
};
