"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { useTenant } from "./tenant-provider";

export function TenantLink({
  href,
  ...props
}: ComponentProps<typeof Link>) {
  const tenant = useTenant();
  const resolvedHref = typeof href === "string" ? tenant.href(href) : href;
  return <Link href={resolvedHref} {...props} />;
}
