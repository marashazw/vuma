import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/ui/TopBar";
import { DriverNavWithCount } from "./driver-nav-with-count";
import { SosListener } from "@/components/driver/SosListener";
import { LocationBroadcaster } from "@/components/driver/LocationBroadcaster";
import { BackToAdminBar } from "@/components/admin/BackToAdminBar";
import { ConnectivityBanner } from "@/components/ui/ConnectivityBanner";
import { SuspendedScreen } from "@/components/ui/SuspendedScreen";
import { DriverNoticeRail } from "@/components/driver/DriverNoticeRail";
import { RideSweepTrigger } from "@/components/ui/RideSweepTrigger";

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();

  if (profile?.role === "rider") redirect("/rider");
  if (profile?.role === "admin") redirect("/admin");

  const { data: driverProfile } = await supabase
    .from("driver_profiles")
    .select("suspended_until, suspension_reason")
    .eq("user_id", user.id)
    .single();
  if (driverProfile?.suspended_until && new Date(driverProfile.suspended_until) > new Date()) {
    return <SuspendedScreen role="driver" suspendedUntil={driverProfile.suspended_until} reason={driverProfile.suspension_reason} />;
  }

  return (
    <div className="min-h-screen bg-paper pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      {profile?.is_super_admin && <BackToAdminBar currentlyViewing="driver" />}
      <TopBar title="Driver" />
      <ConnectivityBanner />
      <RideSweepTrigger />
      <DriverNavWithCount />
      <div className="flex justify-center gap-5">
        <aside className="hidden xl:block w-64 shrink-0 pt-6">
          <DriverNoticeRail position="left" />
        </aside>
        <main className="max-w-3xl w-full px-5 py-6">{children}</main>
        <aside className="hidden xl:block w-64 shrink-0 pt-6">
          <DriverNoticeRail position="right" />
        </aside>
      </div>
      <SosListener />
      <LocationBroadcaster />
    </div>
  );
}
