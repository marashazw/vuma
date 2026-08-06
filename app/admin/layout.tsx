import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopBar } from "@/components/ui/TopBar";
import { AdminTabs } from "./admin-tabs";
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
      <main className="max-w-6xl mx-auto px-5 py-6">{children}</main>
    </div>
  );
}
