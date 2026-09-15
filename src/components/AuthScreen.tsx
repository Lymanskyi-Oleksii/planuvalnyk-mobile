import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuthenticated();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Перевірте пошту — там лист із підтвердженням реєстрації.");
      }
    } catch (err: any) {
      setError(err.message ?? "Щось пішло не так. Спробуйте ще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-canvas font-sans">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl2 border border-line bg-panel p-6 shadow-card"
      >
        <div className="mb-5 flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M3 9.5H21" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 3V6.5M16 3V6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <h1 className="text-lg font-bold text-ink">Планувальник</h1>
        </div>

        <h2 className="mb-4 text-sm font-medium text-muted">
          {mode === "signin" ? "Увійдіть у свій акаунт" : "Створіть акаунт"}
        </h2>

        <div className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Пошта"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль (мінімум 6 символів)"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          />
        </div>

        {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
        {notice && <p className="mt-3 text-xs font-medium text-accent">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-lg bg-accent py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {loading ? "Зачекайте..." : mode === "signin" ? "Увійти" : "Зареєструватись"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
            setNotice(null);
          }}
          className="mt-3 w-full text-center text-xs text-muted hover:text-ink"
        >
          {mode === "signin" ? "Немає акаунту? Зареєструватись" : "Вже є акаунт? Увійти"}
        </button>
      </form>
    </div>
  );
}
