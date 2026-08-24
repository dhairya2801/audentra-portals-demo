"use client";

import type { StudentDocument, StudentRequirementDetail } from "@vv/contracts";
import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import Button from "../design-system/primitives/Button.jsx";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import { documentOutcome, fileSize, officeName, shortDate, stateOf } from "./health-logic";
import { useTenant } from "./tenant-provider";

/**
 * Everything she has sent, one row per file — the reference `RecordHistory`.
 * A file that came back is the one row that carries the replace control. Starts
 * open only when something came back, because that is news.
 */
export function HealthRecordHistory({
  requirement,
  documents,
  onReplace,
}: {
  requirement: StudentRequirementDetail;
  documents: readonly StudentDocument[];
  onReplace: () => void;
}) {
  const { tenant } = useTenant();
  const office = officeName(requirement);
  const cameBack = stateOf(requirement, documents) === "changes-requested";
  const files = [...documents].reverse();

  // Starts closed unless something came back — and follows the record rather
  // than a remembered choice, so a returned file is never hidden on a revisit.
  const [chosen, setChosen] = useState<boolean | null>(null);
  const [followed, setFollowed] = useState(`${cameBack}:${documents.length}`);
  if (followed !== `${cameBack}:${documents.length}`) {
    setFollowed(`${cameBack}:${documents.length}`);
    setChosen(null);
  }
  const open = chosen ?? cameBack;

  if (files.length === 0) return null;

  return (
    <Card className={open ? "" : "collapsed"} aria-labelledby="record-history-title">
      <CardHead
        kind="status"
        titleId="record-history-title"
        title="Everything you have sent"
        note={`${files.length} ${files.length === 1 ? "file" : "files"}, newest first`}
        count={files.length}
        open={open}
        onToggle={() => setChosen(!open)}
        controls="record-history-rows"
      />
      <CardRows id="record-history-rows" hidden={!open}>
        {files.map((file) => {
          const outcome = documentOutcome(file);
          const returned = outcome === "changes-requested";
          const sent = shortDate(file.createdAt, tenant);
          const decided = shortDate(file.review?.decidedAt ?? null, tenant);
          const says = returned
            ? `Came back${decided ? ` ${decided}` : ""}`
            : outcome === "accepted"
              ? `Sent ${sent}${decided ? ` · accepted ${decided}` : " · on your record"}`
              : outcome === "checking"
                ? "Being checked"
                : `Sent ${sent} · with ${office}`;
          return (
            <div className={`record-row${returned ? " returned" : ""}`} key={file.id}>
              <span className="record-row-mark" aria-hidden="true">
                <Icon name="file" size={16} />
              </span>
              <span className="record-row-body">
                <strong>{file.fileName}</strong>
                <span>
                  {fileSize(file.sizeBytes)}
                  {fileSize(file.sizeBytes) ? " · " : ""}
                  {says}
                </span>
              </span>
              {returned ? (
                <Button kind="secondary" icon="arrow" onClick={onReplace}>
                  Replace this file
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardRows>
    </Card>
  );
}
