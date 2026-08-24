"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PageSkeleton from "../../design-system/patterns/PageSkeleton.jsx";
import { PortalShell } from "../../components/portal-shell";
import { useTenant } from "../../components/tenant-provider";

/**
 * Who can see what is a section of Profile — the authorization is read,
 * narrowed and ended there, and an unsigned one is signed there too. This
 * route only forwards to it.
 */
export default function EnrollmentFerpaPage() {
  const router = useRouter();
  const { href } = useTenant();

  useEffect(() => {
    router.replace(href("/profile?section=access"));
  }, [href, router]);

  return (
    <PortalShell active="profile">
      <PageSkeleton label="who can see your record" />
    </PortalShell>
  );
}
