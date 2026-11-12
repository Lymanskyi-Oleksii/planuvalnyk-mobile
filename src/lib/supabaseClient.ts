import { createClient } from "@supabase/supabase-js";

// Експортуються також для нативного запису «Виконано» з сповіщення (lib/reminders.ts)
export const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
export const anonKey: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "Не задані VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Створіть файл .env за прикладом .env.example."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "");
