/**
 * Server-side Supabase client. Use in Server Components, Route Handlers, and
 * Server Actions. Reads cookies via `next/headers`.
 *
 * Cookie writes from Server Components throw silently — the middleware
 * (lib/supabase/middleware.ts) is what actually refreshes the session cookie
 * on every request.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components can't write cookies. The middleware refreshes
            // the session — this catch makes Server Component reads safe.
          }
        },
      },
    },
  );
}
