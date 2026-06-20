import type { Page } from '@playwright/test';

export interface SeedSessionOptions {
  onboarded?: boolean;
  displayName?: string;
  email?: string;
  token?: string;
}

// Mirrors what useUserStore and useProfileStore persist to localStorage,
// so the app boots straight into the authenticated state without the UI flow.
export async function seedSession(page: Page, options: SeedSessionOptions = {}) {
  const {
    onboarded = true,
    displayName = 'Mia',
    email = 'mia@example.com',
    token = 'e2e-token',
  } = options;

  await page.addInitScript(
    (seed) => {
      localStorage.setItem('token', seed.token);
      localStorage.setItem('user', JSON.stringify({
        id: '42',
        email: seed.email,
        displayName: seed.displayName,
        createdAt: new Date().toISOString(),
      }));
      if (seed.onboarded) {
        // Partial profile is fine — the store merges it over its defaults.
        localStorage.setItem('userProfile', JSON.stringify({
          displayName: seed.displayName,
          onboardingComplete: true,
        }));
      }
    },
    { onboarded, displayName, email, token },
  );
}
