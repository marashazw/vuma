import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, dark }: { className?: string; dark?: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "font-display font-bold text-2xl tracking-tight flex items-center gap-1",
        dark ? "text-paper" : "text-navy-800",
        className
      )}
    >
      Vuma
      <span className="text-gold-400">.</span>
    </Link>
  );
}
