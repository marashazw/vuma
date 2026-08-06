export function NavNudgeRing({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <span
        className="absolute inset-0 rounded-[6px]"
        style={{
          // Terracotta covers ~90% of the perimeter, leaving a small gap
          // that rotates around — reads as an almost-complete frame with
          // a subtle moving break, rather than a small highlight chasing
          // around an otherwise-invisible ring.
          background: "conic-gradient(from 0deg, #D97757 0%, #D97757 90%, transparent 95%, transparent 100%)",
          animation: "nav-nudge-spin 4s linear infinite",
        }}
      />
      <span className="absolute rounded-[4px] bg-white" style={{ inset: 2 }} />
      <span className="relative">{children}</span>
    </span>
  );
}
