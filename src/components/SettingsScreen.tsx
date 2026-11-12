import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CATEGORY_LABELS, type Category } from "@/types";
import {
  DEFAULT_SETTINGS,
  leadLabel,
  loadSettings,
  saveSettings,
  type ReminderSettings,
} from "@/lib/settings";
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendTestNotification,
} from "@/lib/reminders";
import { Toggle } from "./Toggle";

interface SettingsScreenProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [Category, string][];
const LEAD_PRESETS = [0, 5, 15, 30, 60];
const MIN_PASSWORD = 6;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl2 border border-line bg-panel p-4 shadow-card">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen({ open, onClose }: SettingsScreenProps) {
  const [settings, setSettings] = useState<ReminderSettings>(() => loadSettings());
  const [permission, setPermission] = useState<boolean | null>(null);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSettings(loadSettings());
    setTestMsg(null);
    setPwError(null);
    setPwOk(false);
    setPassword("");
    setRepeat("");
    getNotificationPermission().then(setPermission);
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, [open]);

  if (!open) return null;

  function update(patch: Partial<ReminderSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  function toggleCategory(c: Category) {
    const has = settings.categories.includes(c);
    update({ categories: has ? settings.categories.filter((x) => x !== c) : [...settings.categories, c] });
  }

  async function handleAllow() {
    setPermission(await requestNotificationPermission());
  }

  async function handleTest() {
    setTestMsg(null);
    const ok = await sendTestNotification();
    setPermission(await getNotificationPermission());
    setTestMsg(
      ok
        ? "Готово: сповіщення прийде приблизно через 10 секунд. Можна згорнути застосунок."
        : "Не вдалося. Перевірте, що сповіщення дозволені для застосунку в налаштуваннях телефону."
    );
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    setPwOk(false);
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
      setPwOk(true);
      setPassword("");
      setRepeat("");
    } catch (err: any) {
      setPwError(err.message ?? "Не вдалося змінити пароль. Спробуйте ще раз.");
    } finally {
      setPwBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent";

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

      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-10">
        <Section title="Нагадування">
          <Toggle
            checked={settings.enabled}
            onChange={(v) => update({ enabled: v })}
            label="Нагадування про задачі"
            description="Головний вимикач. Вимкнено: жодних сповіщень."
          />

          <div className={settings.enabled ? "" : "pointer-events-none opacity-40"}>
            <div className="mt-3 border-t border-line pt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Попереджати</span>
                <span className="text-sm font-semibold text-accent">{leadLabel(settings.leadMinutes)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={120}
                step={5}
                value={settings.leadMinutes}
                onChange={(e) => update({ leadMinutes: Number(e.target.value) })}
                className="mt-2 w-full accent-accent"
                aria-label="За скільки хвилин попереджати"
              />
              <div className="mt-1 flex flex-wrap gap-2">
                {LEAD_PRESETS.map((m) => (
                  <button
                    key={m}
                    onClick={() => update({ leadMinutes: m })}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                      settings.leadMinutes === m
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line text-muted hover:border-accent/40"
                    }`}
                  >
                    {m === 0 ? "На початку" : m === 60 ? "1 год" : `${m} хв`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted">
                Діє для всіх задач, у яких немає свого значення. У самій задачі його можна змінити.
              </p>
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <span className="text-sm font-medium">Для яких категорій</span>
              <p className="mb-2 text-xs text-muted">
                Задачі інших категорій не нагадують, поки ви не ввімкнете нагадування в самій задачі.
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => toggleCategory(value)}
                    aria-pressed={settings.categories.includes(value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      settings.categories.includes(value)
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-line text-muted hover:border-accent/40"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-line pt-1">
              <Toggle
                checked={settings.snack}
                onChange={(v) => update({ snack: v })}
                label="Перекус перед тренуванням"
                description="За годину до вечірніх занять категорії «Спорт»."
              />
              <Toggle
                checked={settings.afterWorkoutPulse}
                onChange={(v) => update({ afterWorkoutPulse: v })}
                label="Пульс після тренування"
                description="Через 3 хв після заняття: нагадування виміряти пульс."
              />
            </div>
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-3">
            {permission === null && (
              <p className="text-xs text-muted">
                Сповіщення працюють лише в застосунку на телефоні, тут їх перевірити не можна.
              </p>
            )}
            {permission === false && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                Сповіщення для застосунку вимкнені.
                <button onClick={handleAllow} className="ml-2 font-semibold underline">
                  Дозволити
                </button>
              </div>
            )}
            {permission === true && <p className="text-xs font-medium text-green-700">Сповіщення дозволені.</p>}

            <button
              onClick={handleTest}
              className="w-full rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              Надіслати тестове сповіщення
            </button>
            {testMsg && <p className="text-xs text-muted">{testMsg}</p>}

            <button
              onClick={() => update({ ...DEFAULT_SETTINGS })}
              className="text-xs font-medium text-muted underline"
            >
              Скинути до стандартних
            </button>
          </div>
        </Section>

        <Section title="Акаунт">
          {email && <p className="mb-3 text-sm text-muted">Ви увійшли як {email}</p>}
          <form onSubmit={handleChangePassword} className="space-y-2">
            <label className="block text-xs font-medium text-muted">Змінити пароль</label>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Новий пароль"
              className={inputCls}
            />
            <input
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              placeholder="Повторіть новий пароль"
              className={inputCls}
            />
            {pwError && <p className="text-xs font-medium text-red-600">{pwError}</p>}
            {pwOk && <p className="text-xs font-medium text-green-700">Пароль змінено.</p>}
            <button
              type="submit"
              disabled={pwBusy || !password || !repeat}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-40"
            >
              {pwBusy ? "Зберігаємо..." : "Змінити пароль"}
            </button>
          </form>
        </Section>
      </div>
    </div>
  );
}
