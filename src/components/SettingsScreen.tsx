import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CATEGORY_LABELS, type Category } from "@/types";
import {
  ALERT_MODE_LABELS,
  DEFAULT_SETTINGS,
  THEME_LABELS,
  isValidTime,
  leadLabel,
  loadSettings,
  loadTheme,
  saveSettings,
  saveTheme,
  type AlertMode,
  type ReminderSettings,
  type ThemeMode,
} from "@/lib/settings";
import {
  getNotificationPermission,
  getReminderStatus,
  requestNotificationPermission,
  rescheduleReminders,
  sendTestNotification,
  subscribeReminderStatus,
  type ReminderStatus,
} from "@/lib/reminders";
import { CATEGORY_COLORS, CATEGORY_EMOJI, type PlannedReminder } from "@/lib/reminderPlan";
import { addDays, toISODate } from "@/lib/date";
import { toast } from "@/lib/toast";
import { useBackHandler } from "@/lib/backButton";
import { Toggle } from "./Toggle";

interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];
const ALL_CATEGORIES = CATEGORY_OPTIONS.map(([value]) => value);
const ALERT_MODES = Object.entries(ALERT_MODE_LABELS) as [AlertMode, string][];
const THEME_MODES = Object.entries(THEME_LABELS) as [ThemeMode, string][];
const LEAD_PRESETS = [0, 5, 10, 15, 30, 60];
const MIN_PASSWORD = 6;
const UPCOMING_SHOWN = 5;
const WEEKDAYS_SHORT = ["нд", "пн", "вт", "ср", "чт", "пт", "сб"];

type IconName = "bell" | "clock" | "tag" | "volume" | "sun" | "pulse" | "list" | "user" | "info";

const ICON_PATHS: Record<IconName, string> = {
  bell: "M5.5 14h9l-1.2-1.8V9a3.3 3.3 0 00-6.6 0v3.2L5.5 14zM8.6 16.2a1.5 1.5 0 002.8 0",
  clock: "M10 6v4l2.5 1.5M17 10a7 7 0 11-14 0 7 7 0 0114 0z",
  tag: "M3.5 10.2V4.5a1 1 0 011-1h5.7l6.3 6.3a1 1 0 010 1.4l-5.3 5.3a1 1 0 01-1.4 0l-6.3-6.3zM7 7h.01",
  volume: "M4 8v4h2.5L10 15V5L6.5 8H4zM13 7.5a3.5 3.5 0 010 5M15 5.5a6.3 6.3 0 010 9",
  sun: "M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5 5l1.1 1.1M13.9 13.9L15 15M5 15l1.1-1.1M13.9 6.1L15 5M13 10a3 3 0 11-6 0 3 3 0 016 0z",
  pulse: "M3 10.5h3l1.5-4 3 8 1.8-4H17",
  list: "M7.5 6h9M7.5 10h9M7.5 14h9M3.8 6h.01M3.8 10h.01M3.8 14h.01",
  user: "M13 7a3 3 0 11-6 0 3 3 0 016 0zM4.5 16.5a5.5 5.5 0 0111 0",
  info: "M10 9v5M10 6.2v.1M17 10a7 7 0 11-14 0 7 7 0 0114 0z",
};

function Icon({ name, className = "h-[18px] w-[18px]" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <path d={ICON_PATHS[name]} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: IconName;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl2 border border-line bg-panel p-4 shadow-card">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Icon name={icon} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-ink">{label}</span>
      <input
        type="time"
        value={value}
        onChange={(e) => {
          if (isValidTime(e.target.value)) onChange(e.target.value);
        }}
        className="rounded-lg border border-line bg-panel px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-accent"
      />
    </label>
  );
}

function pluralReminders(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 1 && mod10 <= 4 && (mod100 < 11 || mod100 > 14)) return `${n} нагадування`;
  return `${n} нагадувань`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** «сьогодні о 17:45», «завтра о 08:00», «пт 14.11 о 09:00» */
function whenLabel(when: Date): string {
  const time = `${pad(when.getHours())}:${pad(when.getMinutes())}`;
  const day = toISODate(when);
  const today = toISODate(new Date());
  if (day === today) return `сьогодні о ${time}`;
  if (day === addDays(today, 1)) return `завтра о ${time}`;
  return `${WEEKDAYS_SHORT[when.getDay()]} ${pad(when.getDate())}.${pad(when.getMonth() + 1)} о ${time}`;
}

interface StatusView {
  tone: "accent" | "muted" | "danger";
  title: string;
  text: string;
}

function statusView(status: ReminderStatus, enabled: boolean, permission: boolean | null): StatusView {
  if (!enabled) {
    return { tone: "muted", title: "Нагадування вимкнено", text: "Застосунок не надсилає жодних сповіщень." };
  }
  if (permission === false || status.state === "denied") {
    return {
      tone: "danger",
      title: "Сповіщення заборонені",
      text: "Дозвольте сповіщення для застосунку, інакше нагадування не приходитимуть.",
    };
  }
  if (status.state === "error") {
    return {
      tone: "danger",
      title: "Не вдалося оновити нагадування",
      text: "Перевірте з'єднання з інтернетом. Раніше заплановані сповіщення залишаються.",
    };
  }
  if (status.state === "idle") {
    return { tone: "accent", title: "Нагадування увімкнено", text: "Оновлюємо розклад сповіщень…" };
  }

  const next = status.plan[0];
  const count =
    status.plan.length === 0
      ? "На найближчий тиждень нагадувань немає."
      : `Заплановано ${pluralReminders(status.plan.length)} на тиждень. Найближче ${whenLabel(next.when)}.`;
  return {
    tone: "accent",
    title: "Нагадування увімкнено",
    text:
      status.state === "inapp"
        ? `${count} На комп'ютері вони з'являються в застосунку, поки він відкритий; системні сповіщення працюють на телефоні.`
        : count,
  };
}

const TONE_STYLES: Record<StatusView["tone"], { card: string; badge: string }> = {
  accent: { card: "border-accent/30 bg-accent-soft", badge: "bg-accent text-white" },
  muted: { card: "border-line bg-panel", badge: "bg-line text-muted" },
  danger: { card: "border-danger-line bg-danger-soft", badge: "bg-danger-strong text-white" },
};

function UpcomingRow({ item }: { item: PlannedReminder }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{item.title}</p>
        <p className="truncate text-xs text-muted">{item.body}</p>
      </div>
      <span className="shrink-0 text-right text-xs font-medium text-muted">
        {whenLabel(item.when)}
        {item.silent && <span className="block font-normal">без звуку</span>}
      </span>
    </li>
  );
}

export function SettingsScreen({ open, onClose, onLogout }: SettingsScreenProps) {
  const [settings, setSettings] = useState<ReminderSettings>(() => loadSettings());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [permission, setPermission] = useState<boolean | null>(null);
  const [status, setStatus] = useState<ReminderStatus>(() => getReminderStatus());
  const [testBusy, setTestBusy] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [pwOpen, setPwOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSettings(loadSettings());
    setStatus(getReminderStatus());
    setPwOpen(false);
    setPwError(null);
    setPassword("");
    setRepeat("");
    getNotificationPermission().then(setPermission);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    import("@tauri-apps/api/app")
      .then((app) => app.getVersion())
      .then(setVersion)
      .catch(() => setVersion(null)); // відкрито не в Tauri
    return subscribeReminderStatus(setStatus);
  }, [open]);

  // «Назад»: спершу ховаємо форму зміни пароля, потім закриваємо налаштування
  useBackHandler(open, onClose);
  useBackHandler(open && pwOpen, () => setPwOpen(false));

  if (!open) return null;

  function apply(next: ReminderSettings) {
    setSettings(next);
    saveSettings(next);
  }

  function update(patch: Partial<ReminderSettings>) {
    apply({ ...settings, ...patch });
  }

  function toggleCategory(c: Category) {
    const has = settings.categories.includes(c);
    update({ categories: has ? settings.categories.filter((x) => x !== c) : [...settings.categories, c] });
  }

  async function handleAllow() {
    const granted = await requestNotificationPermission();
    setPermission(granted);
    if (granted) {
      toast.success("Сповіщення дозволено");
      void rescheduleReminders();
    } else {
      toast.error("Сповіщення заборонені", {
        message: "Увімкніть їх для застосунку в налаштуваннях телефону.",
      });
    }
  }

  async function handleTest() {
    setTestBusy(true);
    const result = await sendTestNotification();
    setTestBusy(false);
    setPermission(await getNotificationPermission());
    if (result === "scheduled") {
      toast.success("Тестове сповіщення надіслано", {
        message: "Прийде приблизно через 5 секунд. Можна згорнути застосунок.",
      });
    } else if (result === "denied") {
      toast.error("Сповіщення заборонені", {
        message: "Увімкніть їх для застосунку в налаштуваннях телефону.",
      });
    } else if (result === "failed") {
      toast.error("Не вдалося надіслати сповіщення", { message: "Спробуйте ще раз." });
    }
    // "inapp": тестове нагадування вже показано карткою в застосунку
  }

  function handleReset() {
    const previous = settings;
    apply({ ...DEFAULT_SETTINGS, categories: [...DEFAULT_SETTINGS.categories] });
    toast.info("Налаштування скинуто до стандартних", {
      duration: 7000,
      action: { label: "Скасувати", onClick: () => apply(previous) },
    });
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (password.length < MIN_PASSWORD) {
      setPwError(`Пароль має містити не менше ${MIN_PASSWORD} символів.`);
      return;
    }
    if (password !== repeat) {
      setPwError("Паролі не збігаються.");
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setRepeat("");
      setPwOpen(false);
      toast.success("Пароль змінено");
    } catch (err: any) {
      setPwError(err?.message ?? "Не вдалося змінити пароль. Спробуйте ще раз.");
    } finally {
      setPwBusy(false);
    }
  }

  const view = statusView(status, settings.enabled, permission);
  const tone = TONE_STYLES[view.tone];
  const upcoming = settings.enabled ? status.plan.slice(0, UPCOMING_SHOWN) : [];
  const dimmed = settings.enabled ? "" : "pointer-events-none opacity-40";

  const chipBase = "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors";
  const chipOn = "border-accent bg-accent-soft text-accent";
  const chipOff = "border-line text-muted hover:border-accent/40";
  const inputCls =
    "w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink outline-none focus:border-accent";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-canvas font-sans text-ink">
      <header
        style={{ paddingTop: "env(safe-area-inset-top)" }}
        className="flex min-h-11 shrink-0 items-center gap-2 border-b border-line bg-panel px-3"
      >
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas"
          aria-label="Назад"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-sm font-semibold">Налаштування</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 40px)" }}>
        <div className="mx-auto w-full max-w-xl space-y-4">
          {/* Стан нагадувань і головний вимикач */}
          <section className={`rounded-xl2 border p-4 shadow-card transition-colors ${tone.card}`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone.badge}`}>
                <Icon name="bell" className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{view.title}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted">{view.text}</p>
                {settings.enabled && permission === false && (
                  <button
                    onClick={handleAllow}
                    className="mt-2 rounded-lg bg-danger-strong px-3 py-1.5 text-xs font-semibold text-white hover:bg-danger-strong/90"
                  >
                    Дозволити сповіщення
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3 border-t border-ink/5 pt-1">
              <Toggle
                checked={settings.enabled}
                onChange={(v) => update({ enabled: v })}
                label="Нагадування про задачі"
                description="Головний вимикач для всіх сповіщень застосунку."
              />
            </div>
          </section>

          <div className={`space-y-4 ${dimmed}`} aria-hidden={!settings.enabled}>
            <Section icon="clock" title="Коли нагадувати" hint="Для задач, у яких немає власного значення.">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink">Попереджати</span>
                <span className="text-sm font-semibold text-accent">{leadLabel(settings.leadMinutes)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                step={5}
                value={Math.min(settings.leadMinutes, 120)}
                onChange={(e) => update({ leadMinutes: Number(e.target.value) })}
                className="mt-2 w-full accent-accent"
                aria-label="За скільки хвилин попереджати"
              />
              <div className="mt-1 flex flex-wrap gap-2">
                {LEAD_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => update({ leadMinutes: m })}
                    aria-pressed={settings.leadMinutes === m}
                    className={`${chipBase} ${settings.leadMinutes === m ? chipOn : chipOff}`}
                  >
                    {m === 0 ? "На початку" : m === 60 ? "1 год" : `${m} хв`}
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-1">
                <Toggle
                  checked={settings.atStart}
                  onChange={(v) => update({ atStart: v })}
                  label="Ще раз у момент початку"
                  description="Друге сповіщення, коли задача починається."
                />
              </div>
            </Section>

            <Section
              icon="tag"
              title="Категорії"
              hint="Інші задачі не нагадують, поки ви не ввімкнете нагадування в самій задачі."
            >
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(([value, label]) => {
                  const on = settings.categories.includes(value);
                  const color = CATEGORY_COLORS[value];
                  return (
                    <button
                      key={value}
                      onClick={() => toggleCategory(value)}
                      aria-pressed={on}
                      className={`${chipBase} ${on ? "" : chipOff}`}
                      style={on ? { borderColor: color, backgroundColor: `${color}1A`, color } : undefined}
                    >
                      <span className="mr-1" aria-hidden="true">
                        {CATEGORY_EMOJI[value]}
                      </span>
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-4 text-xs font-medium text-muted">
                <button onClick={() => update({ categories: [...ALL_CATEGORIES] })} className="underline">
                  Усі
                </button>
                <button onClick={() => update({ categories: [] })} className="underline">
                  Жодної
                </button>
              </div>
            </Section>

            <Section icon="volume" title="Звук і тихі години">
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1" role="radiogroup" aria-label="Звук сповіщень">
                {ALERT_MODES.map(([value, label]) => (
                  <button
                    key={value}
                    role="radio"
                    aria-checked={settings.alertMode === value}
                    onClick={() => update({ alertMode: value })}
                    className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                      settings.alertMode === value ? "bg-panel text-accent shadow-card" : "text-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 border-t border-line pt-1">
                <Toggle
                  checked={settings.quietEnabled}
                  onChange={(v) => update({ quietEnabled: v })}
                  label="Тихі години"
                  description="У цей час сповіщення приходять без звуку й вібрації."
                />
                {settings.quietEnabled && (
                  <div className="pb-1">
                    <TimeField label="Початок" value={settings.quietFrom} onChange={(v) => update({ quietFrom: v })} />
                    <TimeField label="Кінець" value={settings.quietTo} onChange={(v) => update({ quietTo: v })} />
                  </div>
                )}
              </div>
            </Section>

            <Section icon="sun" title="Підсумки дня" hint="Одне сповіщення з усіма запланованими задачами дня.">
              <Toggle
                checked={settings.morningDigest}
                onChange={(v) => update({ morningDigest: v })}
                label="Ранковий план"
                description="Скільки задач сьогодні і коли перша."
              />
              {settings.morningDigest && (
                <TimeField label="Час" value={settings.morningTime} onChange={(v) => update({ morningTime: v })} />
              )}
              <div className="mt-1 border-t border-line pt-1">
                <Toggle
                  checked={settings.eveningReview}
                  onChange={(v) => update({ eveningReview: v })}
                  label="Вечірній підсумок"
                  description="Що залишилось невиконаним. Не приходить, якщо все зроблено."
                />
                {settings.eveningReview && (
                  <TimeField label="Час" value={settings.eveningTime} onChange={(v) => update({ eveningTime: v })} />
                )}
              </div>
            </Section>

            <Section icon="pulse" title="Тренування" hint="Додаткові нагадування для категорії «Спорт».">
              <Toggle
                checked={settings.snack}
                onChange={(v) => update({ snack: v })}
                label="Перекус перед тренуванням"
                description="За годину до занять, що починаються о 17:00 або пізніше."
              />
              <Toggle
                checked={settings.afterWorkoutPulse}
                onChange={(v) => update({ afterWorkoutPulse: v })}
                label="Пульс після тренування"
                description="Через 3 хв після заняття: нагадування виміряти пульс."
              />
            </Section>

            <Section icon="list" title="Найближчі нагадування">
              {upcoming.length > 0 ? (
                <ul className="divide-y divide-line">
                  {upcoming.map((item) => (
                    <UpcomingRow key={item.key} item={item} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">
                  {status.state === "idle"
                    ? "Оновлюємо…"
                    : "Поки що нічого не заплановано. Додайте задачу з часом або ввімкніть потрібні категорії."}
                </p>
              )}
              {status.plan.length > upcoming.length && upcoming.length > 0 && (
                <p className="mt-1 text-xs text-muted">і ще {status.plan.length - upcoming.length}</p>
              )}
              <button
                onClick={handleTest}
                disabled={testBusy}
                className="mt-3 w-full rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40"
              >
                Надіслати тестове сповіщення
              </button>
            </Section>
          </div>

          <Section icon="sun" title="Оформлення">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-canvas p-1" role="radiogroup" aria-label="Тема">
              {THEME_MODES.map(([value, label]) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => {
                    setTheme(value);
                    saveTheme(value);
                  }}
                  className={`rounded-md px-2 py-2 text-xs font-medium transition-colors ${
                    theme === value ? "bg-panel text-accent shadow-card" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          <Section icon="user" title="Акаунт" hint={email ? `Ви увійшли як ${email}` : undefined}>
            {pwOpen ? (
              <form onSubmit={handleChangePassword} className="space-y-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Новий пароль"
                  aria-label="Новий пароль"
                  className={inputCls}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                  placeholder="Повторіть новий пароль"
                  aria-label="Повторіть новий пароль"
                  className={inputCls}
                />
                {pwError && <p className="text-xs font-medium text-danger">{pwError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPwOpen(false)}
                    className="flex-1 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    disabled={pwBusy || !password || !repeat}
                    className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
                  >
                    {pwBusy ? "Зберігаємо..." : "Зберегти"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setPwOpen(true)}
                  className="flex-1 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
                >
                  Змінити пароль
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="flex-1 rounded-lg border border-danger-line px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft"
                  >
                    Вийти
                  </button>
                )}
              </div>
            )}
          </Section>

          <Section icon="info" title="Про застосунок" hint={version ? `Планувальник, версія ${version}` : "Планувальник"}>
            <p className="text-xs text-muted">
              Налаштування нагадувань зберігаються на цьому пристрої, тому на телефоні й комп'ютері вони можуть бути
              різними.
            </p>
            <button onClick={handleReset} className="mt-3 text-xs font-medium text-muted underline">
              Скинути налаштування до стандартних
            </button>
          </Section>
        </div>
      </div>
    </div>
  );
}
