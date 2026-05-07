export const INBOX_LAST_SEEN_KEY = "snickr.inbox.lastSeen";
export const INBOX_SEEN_EVENT = "snickr:inbox-seen";

export function markInboxSeen(): void {
  localStorage.setItem(INBOX_LAST_SEEN_KEY, String(Date.now()));
  window.dispatchEvent(new Event(INBOX_SEEN_EVENT));
}

export function readInboxLastSeen(): number {
  const raw = localStorage.getItem(INBOX_LAST_SEEN_KEY);
  return raw == null ? Date.now() : Number(raw);
}
