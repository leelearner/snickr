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

function dateInNewYork(value: string): Date | null {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (hasTimeZone) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/,
  );
  if (!match) return null;
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
    ),
  );
}

function easternDateParts(value: string): { year: number; month: number; day: number } | null {
  const date = dateInNewYork(value);
  if (!date) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function dateKey(value: string | null | undefined): string {
  if (!value) return "";
  const parts = easternDateParts(value);
  if (!parts) return value;
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function formatDateDivider(value: string | null | undefined): string {
  if (!value) return "";
  const parts = easternDateParts(value);
  if (!parts) return value;
  const today = easternDateParts(new Date().toISOString());
  if (today) {
    if (parts.year === today.year && parts.month === today.month && parts.day === today.day) {
      return "Today";
    }
    const yesterday = new Date(Date.UTC(today.year, today.month - 1, today.day));
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayParts = easternDateParts(yesterday.toISOString());
    if (
      yesterdayParts &&
      parts.year === yesterdayParts.year &&
      parts.month === yesterdayParts.month &&
      parts.day === yesterdayParts.day
    ) {
      return "Yesterday";
    }
  }
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${monthNames[parts.month - 1]} ${parts.day}, ${parts.year}`;
}

export function formatTimeShort(value: string | null | undefined): string {
  if (!value) return "";
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (hasTimeZone) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }
  const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/);
  if (!match) return value;
  return `${match[1]}:${match[2]}`;
}

export function channelDisplayName(channel: {
  channelName: string;
  type: string;
  directUsername?: string | null;
  directNickname?: string | null;
}): string {
  if (channel.type === "direct") {
    const nick = channel.directNickname && !/[<>]/.test(channel.directNickname) ? channel.directNickname : null;
    return nick ?? channel.directUsername ?? "Direct message";
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
