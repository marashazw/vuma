import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/ui/TopBar";
import { BottomNavClient } from "./bottom-nav-client";
import { RiderDesktopTabs } from "./desktop-tabs-client";
import { BackToAdminBar } from "@/components/admin/BackToAdminBar";
import { ConnectivityBanner } from "@/components/ui/ConnectivityBanner";
import { SuspendedScreen } from "@/components/ui/SuspendedScreen";
import { RideSweepTrigger } from "@/components/ui/RideSweepTrigger";

export default async function RiderLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_super_admin, suspended_until, suspension_reason")
    .eq("id", user.id)
    .single();

  if (profile?.role === "driver") redirect("/driver");
  if (profile?.role === "admin") redirect("/admin");

  if (profile?.suspended_until && new Date(profile.suspended_until) > new Date()) {
    return <SuspendedScreen role="rider" suspendedUntil={profile.suspended_until} reason={profile.suspension_reason} />;
  }

  return (
    <div className="min-h-screen bg-paper pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      {profile?.is_super_admin && <BackToAdminBar currentlyViewing="rider" />}
      <TopBar title="Rider" />
      <ConnectivityBanner />
      <RideSweepTrigger />
      <RiderDesktopTabs />
      <main className="max-w-3xl mx-auto px-5 py-6">{children}</main>
      <BottomNavClient />
    </div>
  );
}
