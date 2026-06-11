function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForFingerprint(value: string | null | undefined) {
  if (!value) return "";
  return collapseWhitespace(value).toLowerCase();
}

export function normalizeTextInput(value: string | null | undefined) {
  if (!value) return null;
  const collapsed = collapseWhitespace(value);
  return collapsed.length > 0 ? collapsed : null;
}
