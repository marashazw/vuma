import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; driverRef?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-navy-800 flex flex-col items-center justify-center p-6">
      <div className="mb-8">
        <Logo dark />
      </div>
      <AuthForm mode="signup" referralCode={params?.ref} driverReferralCode={params?.driverRef} />
      {params?.ref && (
        <p className="text-jade-400 text-xs mt-4 bg-jade-500/10 px-3 py-1.5 rounded-full">
          You were invited by a friend — ride credits kick in once you complete your first trip.
        </p>
      )}
      {params?.driverRef && (
        <p className="text-jade-400 text-xs mt-4 bg-jade-500/10 px-3 py-1.5 rounded-full">
          You were invited by a fellow driver — sign up as a driver to link your referral.
        </p>
      )}
      <p className="text-navy-300 text-sm mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-gold-400 font-semibold">
          Log in
        </Link>
      </p>
    </main>
  );
}
