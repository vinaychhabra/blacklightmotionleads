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
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ClipboardList,
  MessageCircle,
  Mail,
  ChevronDown,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase/client";
import { fetchSettings } from "@/lib/supabase/queries";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/lead-generator", label: "AI Lead Generator", icon: Sparkles },
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [logsOpen, setLogsOpen] = useState(pathname.startsWith("/email-logs") || pathname.startsWith("/whatsapp-logs"));

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
    <aside
      className={`flex h-screen shrink-0 flex-col border-r border-border bg-gradient-to-b from-white via-slate-50 to-slate-100 transition-all duration-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <div className={`relative flex items-center border-b border-border ${isCollapsed ? "justify-center px-2 py-4" : "gap-3 px-3 py-4"}`}>
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-400 to-cyan-400 p-1 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt={companyName} className="h-full w-full rounded-md object-cover" />
        </div>
        {!isCollapsed && (
          <div className="min-w-0">
            <div className="truncate font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">
              {companyName}
            </div>
            <div className="text-[8px] uppercase tracking-[0.24em] text-ink-dim">CRM</div>
          </div>
        )}
        <button
          type="button"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setIsCollapsed((value) => !value)}
          className={`flex h-7 w-7 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-row hover:text-ink ${
            isCollapsed ? "absolute right-2" : "ml-auto"
          }`}
        >
          {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      <nav className={`flex-1 space-y-1 py-3 ${isCollapsed ? "px-2" : "px-2.5"}`}>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={`relative flex items-center rounded-lg text-sm font-medium transition-all ${
                isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2.5 py-2"
              } ${
                active
                  ? "bg-gradient-to-r from-amber/15 via-white to-cyan/10 text-ink shadow-sm ring-1 ring-amber/20 dark:from-amber/10 dark:via-slate-800 dark:to-cyan/10"
                  : "text-ink-dim hover:bg-row hover:text-ink"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.4 : 2} className={active ? "text-amber" : ""} />
              {!isCollapsed && <span className="flex-1">{label}</span>}
              {!isCollapsed && href === "/followups" && !!dueCount && (
                <span className="rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
                  {dueCount}
                </span>
              )}
              {isCollapsed && href === "/followups" && !!dueCount && (
                <span className="absolute -right-1 top-1 rounded-full bg-danger px-1 py-0.5 text-[8px] font-bold text-white">
                  {dueCount}
                </span>
              )}
            </Link>
          );
        })}
        <div>
          <button
            type="button"
            onClick={() => setLogsOpen((value) => !value)}
            title={isCollapsed ? "Logs" : undefined}
            className={`relative flex w-full items-center rounded-lg text-sm font-medium transition-all ${isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-2.5 py-2"} ${pathname.startsWith("/email-logs") || pathname.startsWith("/whatsapp-logs") ? "bg-gradient-to-r from-amber/15 via-white to-cyan/10 text-ink shadow-sm ring-1 ring-amber/20 dark:from-amber/10 dark:via-slate-800 dark:to-cyan/10" : "text-ink-dim hover:bg-row hover:text-ink"}`}
          >
            <ClipboardList size={16} />
            {!isCollapsed && <><span className="flex-1 text-left">Logs</span><ChevronDown size={14} className={`transition-transform ${logsOpen ? "rotate-180" : ""}`} /></>}
          </button>
          {logsOpen && !isCollapsed && (
            <div className="ml-5 mt-1 space-y-1 border-l border-border pl-2">
              {[
                { href: "/email-logs", label: "Email", icon: Mail },
                { href: "/whatsapp-logs", label: "WhatsApp", icon: MessageCircle },
              ].map(({ href, label, icon: LogIcon }) => (
                <Link key={href} href={href} className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs ${pathname.startsWith(href) ? "bg-row font-semibold text-ink" : "text-ink-dim hover:bg-row hover:text-ink"}`}>
                  <LogIcon size={13} /> {label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className={`space-y-3 border-t border-border py-3 ${isCollapsed ? "px-2" : "px-3"}`}>
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
          {!isCollapsed && <span className="truncate text-[11px] text-ink-dim">{userEmail}</span>}
          <ThemeToggle />
        </div>
        <button
          onClick={handleSignOut}
          title={isCollapsed ? "Sign out" : undefined}
          className={`flex items-center rounded-lg text-sm font-medium text-ink-dim transition-colors hover:bg-row hover:text-danger ${
            isCollapsed ? "justify-center px-2 py-2" : "w-full gap-2 px-2.5 py-2"
          }`}
        >
          <LogOut size={15} />
          {!isCollapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}
