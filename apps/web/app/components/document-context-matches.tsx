import type { StudentDocumentContextMatch } from "@vv/contracts";
import { safePortalDestination } from "../lib/safe-destination";
import { TenantLink } from "./tenant-link";
import styles from "./document-context-matches.module.css";

export function DocumentContextMatches({
  matches,
}: {
  matches: readonly StudentDocumentContextMatch[] | null | undefined;
}) {
  if (!matches?.length) return null;

  return (
    <section className={styles.panel} aria-label="Document record matches">
      <div className={styles.heading}>
        <div>
          <strong>Where this document helps</strong>
          <p>
            Edward extracted the file. Audentra securely checked that evidence
            against missing items in your authenticated record.
          </p>
        </div>
        <span>Official staff review required</span>
      </div>
      <ul className={styles.list}>
        {matches.map((match) => {
          const destination = safePortalDestination(match.href, "/documents");
          return (
            <li
              className={styles.item}
              key={`${match.targetType}:${match.targetId}`}
            >
              <div>
                <strong>{match.title}</strong>
                <p>{match.rationale}</p>
                <small>
                  {match.status === "sufficient"
                    ? match.applied
                      ? "Your submission is complete for now and is under review."
                      : "The evidence appears sufficient; staff will verify it."
                    : `${match.matchedFieldKeys.length} suggested field${match.matchedFieldKeys.length === 1 ? "" : "s"} available for your review.`}
                </small>
              </div>
              {destination.external ? (
                <a href={destination.href} target="_blank" rel="noreferrer">
                  Review match
                </a>
              ) : (
                <TenantLink href={destination.href}>Review match</TenantLink>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
