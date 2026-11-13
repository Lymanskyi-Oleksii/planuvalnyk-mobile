// Помилки Supabase / Postgres / мережі — українською для користувача.
// Невідомий текст не показуємо як є (він англійською): даємо загальне пояснення.
const NETWORK = "Перевірте з'єднання з інтернетом і спробуйте ще раз.";

const RULES: [RegExp, string][] = [
  [/failed to fetch|network|load failed|timeout|timed out|fetch/i, NETWORK],
  [/invalid login credentials/i, "Невірна пошта або пароль."],
  [/email not confirmed/i, "Пошту ще не підтверджено. Перейдіть за посиланням у листі."],
  [/user already registered|already been registered/i, "Користувач із такою поштою вже є."],
  [/password should be at least|weak password/i, "Пароль закороткий або надто простий."],
  [/new password should be different/i, "Новий пароль має відрізнятися від поточного."],
  [/unable to validate email|invalid email|email address .* is invalid/i, "Невірна адреса пошти."],
  [/rate limit|too many requests|over_.*_rate_limit|after \d+ seconds/i, "Забагато спроб. Зачекайте трохи й спробуйте ще раз."],
  [/jwt expired|invalid jwt|not authenticated|refresh token|session (missing|expired)/i, "Сеанс завершився. Увійдіть у застосунок ще раз."],
  [/row-level security|permission denied|not authorized/i, "Немає доступу до цих даних. Увійдіть ще раз."],
  [/invalid input syntax for type (date|time)|date\/time field value out of range/i, "Невірна дата або час."],
  [/duplicate key|already exists/i, "Такий запис уже є."],
];

/** Зрозумілий українською текст помилки; `fallback` — коли причина невідома. */
export function errorText(err: unknown, fallback = "Щось пішло не так. Спробуйте ще раз."): string {
  const raw = (err as { message?: unknown } | null)?.message;
  const message = typeof raw === "string" ? raw : "";
  if (!message) return NETWORK;
  // Текст уже українською (наші власні помилки) — лишаємо
  if (/[а-яіїєґ]/i.test(message)) return message;
  for (const [re, text] of RULES) if (re.test(message)) return text;
  return fallback;
}

// Помилка «немає такої таблиці»: міграцію ще не запущено
export function isMissingTable(error: { code?: string; message?: string } | null, table: string): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const message = error.message ?? "";
  return new RegExp(table, "i").test(message) && /does not exist|could not find/i.test(message);
}
