import { RideSweepTrigger } from "@/components/ui/RideSweepTrigger";

export default function VumaPrivateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RideSweepTrigger />
      {children}
    </>
  );
}
