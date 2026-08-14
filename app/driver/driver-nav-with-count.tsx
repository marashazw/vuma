"use client";

import { useOpenRequestsCount } from "@/lib/hooks/useOpenRequestsCount";
import { BottomNavClient } from "./bottom-nav-client";
import { DriverDesktopTabs } from "./desktop-tabs-client";
import { DriverTopQuickNav } from "@/components/driver/DriverTopQuickNav";

export function DriverNavWithCount() {
  const openRequests = useOpenRequestsCount();
  return (
    <>
      <DriverDesktopTabs openRequests={openRequests} />
      <DriverTopQuickNav openRequests={openRequests} />
      <BottomNavClient />
    </>
  );
}
