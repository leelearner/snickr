export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (hasTimeZone) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  }

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/,
  );
  if (!match) return value;

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const wallClock = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(wallClock);
  return `${formatted} ${isEasternDaylightTime(year, month, day) ? "EDT" : "EST"}`;
}

function isEasternDaylightTime(year: number, month: number, day: number): boolean {
  if (month < 3 || month > 11) return false;
  if (month > 3 && month < 11) return true;
  const secondSundayInMarch = nthWeekdayOfMonth(year, 3, 0, 2);
  const firstSundayInNovember = nthWeekdayOfMonth(year, 11, 0, 1);
  if (month === 3) return day >= secondSundayInMarch;
  return day < firstSundayInNovember;
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, occurrence: number): number {
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (weekday - firstDay + 7) % 7;
  return 1 + offset + (occurrence - 1) * 7;
}

export function channelDisplayName(channel: {
  channelName: string;
  type: string;
  directUsername?: string | null;
  directNickname?: string | null;
}): string {
  if (channel.type === "direct") {
    return channel.directNickname ?? channel.directUsername ?? "Direct message";
  }
  return channel.channelName;
}

export function initials(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "detail" in error) {
    return String((error as { detail: unknown }).detail);
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function trimOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
