"use client";

import { useOpenRequestsCount } from "@/lib/hooks/useOpenRequestsCount";
import { BottomNavClient } from "./bottom-nav-client";
import { DriverDesktopTabs } from "./desktop-tabs-client";

export function DriverNavWithCount() {
  const openRequests = useOpenRequestsCount();
  return (
    <>
      <DriverDesktopTabs openRequests={openRequests} />
      <BottomNavClient openRequests={openRequests} />
    </>
  );
}
