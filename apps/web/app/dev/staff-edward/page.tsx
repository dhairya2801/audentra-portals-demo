/**
 * Staff Edward Lab — developer trace dashboard route.
 *
 * Server-gated exactly like /dev/edward: outside development the page
 * requires an explicit NEXT_PUBLIC_EDWARD_DEBUG_ENABLED=true at build time,
 * otherwise it is a 404. The shared /api/edward-lab/* proxy routes apply the
 * same gate at request time, and the platform's trace endpoints stay
 * worker-token protected and disabled in production regardless.
 */

import { notFound } from "next/navigation";
import { StaffEdwardLab } from "../../components/staff-edward-lab";
import { edwardLabEnabled } from "../../lib/edward-lab";

export const metadata = {
  title: "Staff Edward Lab",
  robots: { index: false, follow: false },
};

export default function StaffEdwardLabPage() {
  if (
    !edwardLabEnabled({
      NEXT_PUBLIC_EDWARD_DEBUG_ENABLED: process.env.NEXT_PUBLIC_EDWARD_DEBUG_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
    })
  ) {
    notFound();
  }
  return <StaffEdwardLab />;
}
