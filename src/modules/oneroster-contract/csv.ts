export function toCsv(headers: readonly string[], rows: readonly object[]) {
  return [
    headers.join(","),
    ...rows.map((row) => {
      const record = row as Record<string, unknown>;
      return headers.map((header) => csvCell(record[header])).join(",");
    }),
  ].join("\n");
}

function csvCell(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }
  const text = String(value);
  if (!/[",\n\r]/.test(text)) {
    return text;
  }
  return `"${text.replaceAll('"', '""')}"`;
}
