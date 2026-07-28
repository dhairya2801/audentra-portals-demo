import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { isTenantSlug } from "../lib/tenant";

export default async function UniversityTenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  if (!isTenantSlug(tenant)) notFound();
  return children;
}
