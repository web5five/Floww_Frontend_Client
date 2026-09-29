/** Only product routes can be resumed after login; never redirect to another origin. */
export function loginReturnTo(value: string | null | undefined): string {
  const fallback = "/pharmacy";
  if (!value || value.length > 2048 || !value.startsWith("/") || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, "https://floww.invalid");
    if (url.origin !== "https://floww.invalid") return fallback;
    const allowed = /^\/(pharmacy|dashboard|voice)\/?$/.test(url.pathname)
      || /^\/chat\/[a-zA-Z0-9-]+$/.test(url.pathname)
      || /^\/journey\/[a-zA-Z0-9-]+\/(mandate|decision|approval|result)$/.test(url.pathname);
    return allowed ? url.pathname + url.search : fallback;
  } catch { return fallback; }
}
