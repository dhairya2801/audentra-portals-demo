"use client";

import { FerpaAccessCenter } from "../../components/ferpa-access-center";
import { PortalShell } from "../../components/portal-shell";

export default function EnrollmentFerpaPage() {
  return (
    <PortalShell
      active="enrollment"
      eyebrow="Enrollment center"
      title="FERPA access"
      description="Manage the people, portal pages, and secure links covered by your completed authorization."
    >
      <FerpaAccessCenter mode="manage" />
    </PortalShell>
  );
}
