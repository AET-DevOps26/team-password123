/** Known feature-flag names — keep in sync with ops / Bruno collections. */
export const FEATURES = {
  /** Gemini / Auto / Nemotron selector before analyzing a photo. */
  SCAN_VISION_MODEL_PICKER: 'scan-vision-model-picker',
} as const;

export type FeatureName = (typeof FEATURES)[keyof typeof FEATURES];

export const ALL_FEATURES: FeatureName[] = Object.values(FEATURES);
