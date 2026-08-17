export type ContentDateInput = Date | string | null | undefined;

export function normalizeContentDate(value: ContentDateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const raw = value.trim();
  if (!raw) return null;

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const date = new Date(`${raw}T00:00:00.000Z`);
    return isValidDateParts(date, Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])) ? date : null;
  }

  const sqlite = raw.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (sqlite) {
    const date = new Date(`${sqlite[1]}-${sqlite[2]}-${sqlite[3]}T${sqlite[4]}:${sqlite[5]}:${sqlite[6]}.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toMetadataDate(...values: ContentDateInput[]) {
  return firstValidDate(values)?.toISOString();
}

export function toSitemapDate(...values: ContentDateInput[]) {
  return firstValidDate(values) ?? undefined;
}

function firstValidDate(values: ContentDateInput[]) {
  for (const value of values) {
    const date = normalizeContentDate(value);
    if (date) return date;
  }
  return null;
}

function isValidDateParts(date: Date, year: number, month: number, day: number) {
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
