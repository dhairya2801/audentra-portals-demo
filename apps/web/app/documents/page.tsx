"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";

/**
 * My Documents lives under Profile since the Jam of 2026-08-21: one record,
 * one place. This route only forwards there, carrying `?document=<id>` so a
 * link from Financials or a notification still opens the row it names.
 */
function DocumentsRedirect() {
  const params = useSearchParams();
  const router = useRouter();
  const { href } = useTenant();
  const documentId = params.get("document");

  useEffect(() => {
    router.replace(
      href(
        `/profile?section=documents${documentId ? `&document=${encodeURIComponent(documentId)}` : ""}`,
      ),
    );
  }, [documentId, href, router]);

  return (
    <PortalShell active="documents">
      <PageSkeleton label="your documents" />
    </PortalShell>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <PortalShell active="documents">
          <PageSkeleton label="your documents" />
        </PortalShell>
      }
    >
      <DocumentsRedirect />
    </Suspense>
  );
}
