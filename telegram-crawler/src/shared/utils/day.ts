export function getDayRangeUnix(
  dayKey: string,
  tzOffsetMinutes: number
): { startUnix: number; endUnix: number } {
  const parts = dayKey.split("-");

  if (parts.length !== 3) {
    throw new Error(`dayKey không hợp lệ: ${dayKey}`);
  }

  const [yearStr, monthStr, dayStr] = parts;

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`dayKey không hợp lệ: ${dayKey}`);
  }

  const startUtcMs =
    Date.UTC(year, month - 1, day, 0, 0, 0, 0) - tzOffsetMinutes * 60_000;

  const endUtcMs =
    Date.UTC(year, month - 1, day, 23, 59, 59, 999) -
    tzOffsetMinutes * 60_000;

  return {
    startUnix: Math.floor(startUtcMs / 1000),
    endUnix: Math.floor(endUtcMs / 1000),
  };
}

export function toDayKeyFromUnix(
  unixSeconds: number,
  tzOffsetMinutes: number
): string {
  const shiftedMs = unixSeconds * 1000 + tzOffsetMinutes * 60_000;
  return new Date(shiftedMs).toISOString().slice(0, 10);
}

export function getTodayDayKey(tzOffsetMinutes: number): string {
  const shiftedMs = Date.now() + tzOffsetMinutes * 60_000;
  return new Date(shiftedMs).toISOString().slice(0, 10);
}