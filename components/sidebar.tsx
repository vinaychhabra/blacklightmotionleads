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
  Menu,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabase } from "@/lib/supabase/client";
import { fetchSettings } from "@/lib/supabase/queries";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/lead-generator", label: "AI Lead Generator", icon: Sparkles, badge: "AI" },
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
  const [isDesktop, setIsDesktop] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(pathname.startsWith("/email-logs") || pathname.startsWith("/whatsapp-logs"));

  // the sidebar's collapsed (icon-only) state is a desktop-only affordance —
  // on mobile the drawer always shows full width regardless of this flag
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const collapsed = isDesktop && isCollapsed;

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
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-panel px-4 md:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setIsMobileOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-row hover:text-ink"
        >
          <Menu size={18} />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-amber-400 to-cyan-400 p-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={companyName} className="h-full w-full rounded-sm object-cover" />
          </div>
          <span className="truncate font-display text-[11px] font-bold uppercase tracking-[0.1em] text-ink">{companyName}</span>
        </div>
        <div className="h-8 w-8" />
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-border bg-gradient-to-b from-white via-slate-50 to-slate-100 transition-all duration-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 md:relative md:z-auto md:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${isCollapsed ? "md:w-20" : "md:w-64"}`}
      >
        <div className={`relative flex items-center border-b border-border ${collapsed ? "justify-center px-2 py-4" : "gap-3 px-3 py-4"}`}>
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-amber-400 to-cyan-400 p-1 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={companyName} className="h-full w-full rounded-md object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate font-display text-[12px] font-bold uppercase tracking-[0.12em] text-ink">
                {companyName}
              </div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-ink-dim">CRM</div>
            </div>
          )}
          <button
            type="button"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setIsCollapsed((value) => !value)}
            className={`hidden h-7 w-7 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-row hover:text-ink md:flex ${
              collapsed ? "absolute right-2" : "ml-auto"
            }`}
          >
            {isCollapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setIsMobileOpen(false)}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-dim hover:bg-row hover:text-ink md:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className={`flex-1 space-y-1 overflow-y-auto py-3 ${collapsed ? "px-2" : "px-2.5"}`}>
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-2 py-2" : "gap-3 px-2.5 py-2"
                } ${
                  active
                    ? "bg-amber/10 text-ink ring-1 ring-amber/20"
                    : "text-ink-dim hover:bg-row hover:text-ink"
                }`}
              >
                <Icon size={16} strokeWidth={active ? 2.4 : 2} className={active ? "text-amber" : ""} />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && badge && (
                  <span className="rounded-full border border-amber/30 bg-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber">
                    {badge}
                  </span>
                )}
                {!collapsed && href === "/followups" && !!dueCount && (
                  <span className="rounded-full bg-danger px-1.5 py-0.5 text-[9px] font-bold text-white">
                    {dueCount}
                  </span>
                )}
                {collapsed && href === "/followups" && !!dueCount && (
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
              title={collapsed ? "Logs" : undefined}
              className={`relative flex w-full items-center rounded-lg text-sm font-medium transition-colors ${collapsed ? "justify-center px-2 py-2" : "gap-3 px-2.5 py-2"} ${pathname.startsWith("/email-logs") || pathname.startsWith("/whatsapp-logs") ? "bg-amber/10 text-ink ring-1 ring-amber/20" : "text-ink-dim hover:bg-row hover:text-ink"}`}
            >
              <ClipboardList size={16} />
              {!collapsed && <><span className="flex-1 text-left">Logs</span><ChevronDown size={14} className={`transition-transform ${logsOpen ? "rotate-180" : ""}`} /></>}
            </button>
            {logsOpen && !collapsed && (
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

        <div className={`space-y-2 border-t border-border py-3 ${collapsed ? "px-2" : "px-3"}`}>
          {collapsed ? (
            <div className="flex justify-center">
              <ThemeToggle collapsed />
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-row px-2 py-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-panel">
                {(userEmail?.[0] || "?").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11.5px] font-medium text-ink">{userEmail}</div>
                <div className="text-[10px] text-ink-dim">Signed in</div>
              </div>
              <ThemeToggle />
            </div>
          )}
          <button
            onClick={handleSignOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex items-center rounded-lg text-sm font-medium text-ink-dim transition-colors hover:bg-row hover:text-danger ${
              collapsed ? "justify-center px-2 py-2" : "w-full gap-2 px-2.5 py-2"
            }`}
          >
            <LogOut size={15} />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>
    </>
  );
}
