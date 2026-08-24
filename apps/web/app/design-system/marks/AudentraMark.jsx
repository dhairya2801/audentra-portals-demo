/**
 * Audentra's symbol — the vendor's, not the institution's.
 *
 * This is `docs/brand/symbol.svg` inlined, colours and all, because a vendor
 * credit shows the vendor's mark as the vendor draws it: it is the one place
 * in the product where a colour that is not a token is correct, and it is
 * confined to these four fills. It appears in exactly one place — the
 * "Powered by Audentra" line at the foot of the sidebar — and on the
 * styleguide, which is the page that says so.
 *
 * The brand book (Figma, *Audentra Brand Guidelines*) publishes Color,
 * Reverse, White and Navy versions; `mono` draws the white/navy one in
 * `currentColor` for a surface where the colour symbol would shout.
 */
export default function AudentraMark({ height = 14, mono = false, className, title }) {
  const width = Math.round((height * 192.33) / 149.59);
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 192.33 149.59"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <polygon
        fill={mono ? 'currentColor' : '#1e5bff'}
        points="147 55.02 125.99 94.63 97.87 40.25 118.6 0 147 55.02"
      />
      <path
        fill={mono ? 'currentColor' : '#6a38ff'}
        d="M118.6,0h-33.33c-4.94,0-9.49,2.86-11.86,7.47l-33.95,65.75-11.06,21.42L0,149.59h33.45c4.94,0,9.49-2.86,11.86-7.47l24.53-47.5.46-.9,27.62-53.48L118.6,0Z"
      />
      <polygon
        fill={mono ? 'currentColor' : '#04b2a9'}
        points="154.37 149.59 125.99 94.63 77.31 94.63 154.37 149.59"
      />
      <path
        fill={mono ? 'currentColor' : '#02cdc7'}
        d="M125.99,94.63l21.01-39.6,20.44,39.61,24.26,46.96c1.86,3.6-.59,8-4.45,8h-32.88l-28.38-54.96"
      />
    </svg>
  );
}
