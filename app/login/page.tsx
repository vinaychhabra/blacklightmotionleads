"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { fetchSettings } from "@/lib/supabase/queries";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState("Blacklight Motion");
  const [logoUrl, setLogoUrl] = useState("/logo.png");

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setCompanyName(s.company_name || "Blacklight Motion");
        if (s.logo_url) setLogoUrl(s.logo_url);
      })
      .catch(() => {
        // settings fetch failing shouldn't block login — bundled defaults still apply
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="panel-surface w-full max-w-sm rounded-2xl p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-400 to-cyan-400 p-1 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={companyName} className="h-full w-full rounded-lg object-cover" />
          </div>
          <h1 className="font-display text-base font-bold uppercase tracking-[0.12em] text-ink">{companyName}</h1>
          <p className="mt-1 text-[10px] uppercase tracking-[0.24em] text-ink-dim">CRM — Sign in</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-ink-dim">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-row px-3 py-2.5 text-sm text-ink outline-none focus:border-amber"
              placeholder="you@blacklightmotion.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.18em] text-ink-dim">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-row px-3 py-2.5 text-sm text-ink outline-none focus:border-amber"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-amber to-cyan py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
