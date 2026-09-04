"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Clock,
  MessageSquareText,
  Settings,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase/client";
import { fetchSettings } from "@/lib/supabase/queries";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/followups", label: "Follow-ups", icon: Clock },
  { href: "/templates", label: "Templates", icon: MessageSquareText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ userEmail }: { userEmail?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [dueCount, setDueCount] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState("Blacklight Motion");
  const [logoUrl, setLogoUrl] = useState("/logo.png");

  useEffect(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    supabase
      .from("leads")
      .select("id, follow_up_date, status")
      .then(({ data }) => {
        if (!data) return;
        const count = data.filter(
          (l) =>
            (l.follow_up_date && l.follow_up_date <= todayStr) ||
            (!l.follow_up_date && l.status === "Follow-up")
        ).length;
        setDueCount(count);
      });
  }, [pathname]);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setCompanyName(s.company_name || "Blacklight Motion");
        if (s.logo_url) setLogoUrl(s.logo_url);
      })
      .catch(() => {
        // fall back to bundled defaults if settings fetch fails — never block the sidebar
      });
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-panel">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt={companyName} className="h-8 w-8 rounded-md object-cover" />
        <div>
          <div className="font-display text-sm font-bold uppercase leading-none text-ink">
            {companyName}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-ink-dim">
            CRM
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-gradient-to-r from-amber/15 to-cyan/15 text-ink"
                  : "text-ink-dim hover:bg-row hover:text-ink"
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              <span className="flex-1">{label}</span>
              {href === "/followups" && !!dueCount && (
                <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {dueCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user + theme + sign out */}
      <div className="space-y-3 border-t border-border px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="truncate text-xs text-ink-dim">{userEmail}</span>
          <ThemeToggle />
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-ink-dim transition-colors hover:bg-row hover:text-danger"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
