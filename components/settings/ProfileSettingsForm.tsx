"use client";

import { useEffect, useState } from "react";
import { createClient, getKeepLoggedIn, setKeepLoggedIn } from "@/lib/supabase/client";
import { Loader2, Check, Smartphone } from "lucide-react";
import { useModal } from "@/components/ui/ModalProvider";

export function ProfileSettingsForm() {
  const modal = useModal();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [keepLoggedIn, setKeepLoggedInState] = useState(true);

  useEffect(() => {
    setKeepLoggedInState(getKeepLoggedIn());
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).single();
      setFullName(data?.full_name || "");
      setPhone(data?.phone || "");
      setEmail(data?.email || user.email || null);
      setLoading(false);
    })();
  }, [supabase]);

  function toggleKeepLoggedIn() {
    const next = !keepLoggedIn;
    setKeepLoggedInState(next);
    setKeepLoggedIn(next);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, phone: phone || null })
      .eq("id", user.id);

    setSaving(false);
    if (error) {
      await modal.alert(`Could not save: ${error.message}`);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-navy-300">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-md">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-navy-400 text-sm mt-1">
          Add a phone number so the other person can call or be called during a ride.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        {email && (
          <div>
            <label className="label mb-1.5 block">Email</label>
            <input className="input bg-navy-50" value={email} disabled />
          </div>
        )}

        <div>
          <label className="label mb-1.5 block">Full name</label>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>

        <div>
          <label className="label mb-1.5 block">Phone number</label>
          <input
            className="input"
            type="tel"
            placeholder="+27 82 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-xs text-navy-400 mt-1.5">
            Only shared with the specific rider/driver you're matched with during an active ride — never public.
          </p>
        </div>

        <button className="btn-primary w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      <div className="card p-5">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-start gap-2.5">
            <Smartphone className="w-4 h-4 text-navy-400 mt-0.5 shrink-0" />
            <span>
              <span className="font-semibold text-sm block">Keep me logged in on this device</span>
              <span className="text-xs text-navy-400">
                When on, the app opens straight to your map without needing to log in each time. Turn off on a
                shared or public device.
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            className="w-5 h-5 shrink-0 accent-gold-400"
            checked={keepLoggedIn}
            onChange={toggleKeepLoggedIn}
          />
        </label>
        <p className="text-xs text-navy-300 mt-2">Takes effect the next time you log in.</p>
      </div>
    </div>
  );
}
