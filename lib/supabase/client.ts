import { createBrowserClient } from "@supabase/ssr";

const KEEP_LOGGED_IN_KEY = "vuma_keep_logged_in";

/** Reads the "keep me logged in on this device" preference. Defaults to
 * true (today's existing behavior) if never explicitly set. */
export function getKeepLoggedIn(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(KEEP_LOGGED_IN_KEY);
  return stored === null ? true : stored === "true";
}

/** Sets the preference. Takes effect on next login, not retroactively for
 * an already-issued session cookie. */
export function setKeepLoggedIn(value: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEEP_LOGGED_IN_KEY, String(value));
}

/** Use inside client components ("use client"). */
export function createClient() {
  const keepLoggedIn = getKeepLoggedIn();
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookieOptions: {
      // Omitting maxAge makes it a browser session cookie — cleared when
      // the browser/app fully closes. 100 days matches Supabase's typical
      // refresh-token lifetime ceiling, effectively "stay logged in".
      ...(keepLoggedIn ? { maxAge: 60 * 60 * 24 * 100 } : {}),
    },
  });
}
