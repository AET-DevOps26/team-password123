import { apiClient } from '../../../shared/api/client';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../model/types';
import type { UserResponse } from '../../../entities/user';
import type { Sex, ActivityLevel, GoalKind } from '../../../entities/user/model/profile';

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

// Enum unions are reused from the profile store so the wire tokens stay defined
// in a single place (avoids drift if the backend enum values ever change).
export interface UpdateUserRequest {
  displayName: string;
  heightCm: number;
  weightKg: number;
  age: number;
  sex: Sex;
  activityLevel: ActivityLevel;
  goal: GoalKind;
}
