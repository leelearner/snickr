// Render-time defense against legacy data with HTML-looking nicknames.
// Pydantic now blocks angle brackets at registration, but old rows can still
// contain values like `<img onerror=...>`; in that case fall back to username.
const UNSAFE = /[<>]/;

export function displayName(nickname: string | null | undefined, username: string | null | undefined): string {
  if (nickname && !UNSAFE.test(nickname)) return nickname;
  if (username && !UNSAFE.test(username)) return username;
  return username ?? "";
}
