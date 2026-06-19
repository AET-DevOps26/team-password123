export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
  // Profile fields — null until the user finishes onboarding (or is seeded).
  // Enum values use the same wire tokens as the profile store.
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  sex?: 'female' | 'male' | 'other' | null;
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive' | null;
  goal?: 'lose' | 'maintain' | 'gain' | null;
}
