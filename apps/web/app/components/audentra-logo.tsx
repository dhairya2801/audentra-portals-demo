/**
 * Audentra's wordmark — the vendor's own, drawn from the brand asset.
 *
 * One asset (`/audentra-logo.png`, trimmed to the mark so it can be sized by
 * height alone) and one component, so the landing page, the staff workspace and
 * the student portal's vendor credit cannot drift apart. It is the vendor's
 * mark, never the institution's: a tenant's logo comes from
 * `tenant.branding.logoUrl` through `PortalMark`.
 *
 * Sized by height with `width: auto`, which keeps the aspect ratio at every
 * placement; the file ships at 2x the largest use so it stays crisp.
 */
export function AudentraLogo({
  height = 28,
  className,
  /** The tagline is part of the artwork, so a small placement still reads it. */
  title = "Audentra — institutional intelligence for what’s next",
}: {
  height?: number;
  className?: string;
  title?: string;
}) {
  return (
    <img
      className={className ? `audentra-logo ${className}` : "audentra-logo"}
      src="/audentra-logo.png"
      alt={title}
      style={{ height: `${height}px`, width: "auto" }}
    />
  );
}
