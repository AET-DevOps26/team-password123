import { apiClient } from '../../../shared/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../model/types';
import type { UserResponse } from '../../../entities/user';

export const authApi = {
  login: (body: LoginRequest): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>('/auth/login', body),

  register: (body: RegisterRequest): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>('/auth/register', body),

  me: (): Promise<UserResponse> =>
    apiClient.get<UserResponse>('/users/me'),

  update: (body: UpdateUserRequest): Promise<UserResponse> =>
    apiClient.put<UserResponse>('/users/me', body),
};

export interface UpdateUserRequest {
  displayName: string;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: 'female' | 'male' | 'other';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
  goal: 'lose' | 'maintain' | 'gain';
}
