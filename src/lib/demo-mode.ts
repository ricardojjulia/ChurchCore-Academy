function isEnabled(value: string | undefined) {
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function isDemoModeEnabledServer() {
  return isEnabled(process.env.DEMO_MODE_ENABLED);
}

export function isDemoModeEnabledClient() {
  return isEnabled(process.env.NEXT_PUBLIC_DEMO_MODE_ENABLED);
}

export function getDemoVersion() {
  return process.env.NEXT_PUBLIC_DEMO_VERSION ?? "dev";
}
