"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./Logo";
import { createClient } from "@/lib/supabase/client";
import { LogOut, Settings, SquareUser } from "lucide-react";

export function TopBar({ title }: { title?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (profile?.full_name) setUserName(profile.full_name);
    })();
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isDriverSection = pathname.startsWith("/driver");
  const isRiderSection = pathname.startsWith("/rider");
  const settingsHref = isDriverSection ? "/driver/settings" : "/rider/settings";

  return (
    <header className="sticky top-0 z-20 bg-paper/90 backdrop-blur border-b border-navy-100 px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4 min-w-0">
        <Logo />
        {title && (
          <span className="hidden sm:flex items-center gap-2 text-navy-300 shrink-0">
            <span className="text-navy-200">&bull;</span> {title}
          </span>
        )}
        {userName && (
          <span className="hidden sm:flex items-center gap-1.5 text-navy-300 truncate">
            <SquareUser className="w-4 h-4 shrink-0" style={{ color: "#D97757" }} /> {userName}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(isDriverSection || isRiderSection) && (
          <Link href={settingsHref} className="btn-ghost !py-2 !px-3 text-sm">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
        )}
        <button onClick={signOut} className="btn-ghost !py-2 !px-3 text-sm">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </header>
  );
}
