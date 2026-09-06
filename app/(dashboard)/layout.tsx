"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "@/components/sidebar";
import { ToastProvider } from "@/components/toast-provider";
import { ConfirmProvider } from "@/components/confirm-provider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | "loading">("loading");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
      } else {
        setSession(data.session);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession) {
        router.replace("/login");
      } else {
        setSession(newSession);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (session === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="flex h-screen overflow-hidden bg-bg">
          <Sidebar userEmail={session?.user?.email} />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto max-w-7xl px-5 py-7 md:px-8 lg:px-10">
              <div className="space-y-6">{children}</div>
            </div>
          </main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  );
}
