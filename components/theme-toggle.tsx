"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const options = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
] as const;

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // avoid hydration mismatch — theme isn't known until client mounts
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={collapsed ? "h-7 w-7" : "h-8 w-[108px]"} />;

  if (collapsed) {
    const activeIndex = options.findIndex((o) => o.value === theme);
    const current = options[activeIndex === -1 ? 0 : activeIndex];
    const next = options[(Math.max(activeIndex, 0) + 1) % options.length];
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`Theme: ${current.label} (click for ${next.label})`}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-row hover:text-ink"
      >
        <current.icon size={15} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-row p-0.5">
      {options.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => setTheme(value)}
          title={label}
          className={`flex items-center justify-center rounded-md p-1.5 transition-colors ${
            theme === value
              ? "bg-panel text-ink shadow-sm"
              : "text-ink-dim hover:text-ink"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}
