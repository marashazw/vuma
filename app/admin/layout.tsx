import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/ui/TopBar";
import { AdminTabs } from "./admin-tabs";
import { AdminSecondaryNav } from "./admin-secondary-nav";
import { RoleSwitcher } from "@/components/admin/RoleSwitcher";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role, is_super_admin").eq("id", user.id).single();
  if (!profile?.is_super_admin) redirect("/");

  return (
    <div className="min-h-screen bg-paper">
      <TopBar title="Admin" />
      <RoleSwitcher />
      <AdminTabs />
      <div className="max-w-6xl mx-auto px-5 py-6">
        <div className="lg:hidden mb-4">
          <AdminSecondaryNav />
        </div>
        <div className="flex gap-6">
          <aside className="hidden lg:block w-32 shrink-0 border-r border-navy-100 pr-4">
            <AdminSecondaryNav />
          </aside>
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
