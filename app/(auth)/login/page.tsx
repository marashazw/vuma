import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Logo dark />
      </div>
      <AuthForm mode="login" />
      <p className="text-navy-300 text-sm mt-6">
        New to Vuma?{" "}
        <Link href="/signup" className="text-gold-400 font-semibold">
          Create an account
        </Link>
      </p>
    </main>
  );
}
