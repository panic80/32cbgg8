export const FEATURE_FLAGS = {
  enableGlossary: false,
} as const;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

export const isFeatureEnabled = (flag: FeatureFlagKey) => FEATURE_FLAGS[flag];
