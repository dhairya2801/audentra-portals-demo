"use client";
import type { StudentDocument, StudentDocumentCategory } from "@vv/contracts";
import { useRef, useState, type ReactNode } from "react";
import Dropzone from "../design-system/patterns/Dropzone.jsx";
import Notice from "../design-system/patterns/Notice.jsx";
import Button from "../design-system/primitives/Button.jsx";
import { getApiErrorMessage } from "../hooks/use-api-resource";
import { uploadStudentDocument } from "../lib/api-client";
import { documentLine } from "./flow";

const ACCEPT = "application/pdf,image/jpeg,image/png";

/**
 * One file, sent to the platform's document store, and its standing read
 * back as a sentence.
 *
 * Uploads save on their own and survive navigating away — the platform
 * keeps the file, so this never writes to the step's draft. `document` is
 * whatever the caller currently knows about the latest file in this
 * category; the slot only reports what it just sent through `onUploaded`.
 */
export function DocumentSlot({
  category,
  document,
  sentOn,
  emptyTitle,
  emptyLine,
  chooseLabel,
  replaceLabel = "Send a different one",
  leadingIcon = "upload",
  waiting,
  bare = false,
  onUploaded,
}: {
  /** Only the control: no dropzone, no sentence. For a block that shows the file itself. */
  bare?: boolean;
  category: StudentDocumentCategory;
  document: StudentDocument | null;
  sentOn: string | null;
  emptyTitle: string;
  emptyLine: string;
  chooseLabel: string;
  replaceLabel?: string;
  leadingIcon?: string;
  /** What the block says while nothing has been sent. */
  waiting: ReactNode;
  onUploaded: (document: StudentDocument) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const key = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const send = async (file: File) => {
    setPending(true);
    setFailure(null);
    try {
      const idempotencyKey = key.current ?? (key.current = crypto.randomUUID());
      const uploaded = await uploadStudentDocument(
        file,
        { categoryHint: category },
        idempotencyKey,
      );
      key.current = null;
      onUploaded(uploaded);
    } catch (caught) {
      setFailure(getApiErrorMessage(caught));
    } finally {
      setPending(false);
      if (input.current) input.current.value = "";
    }
  };

  const line = documentLine(document, sentOn);

  const control = (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <Button
        kind="secondary"
        leadingIcon={leadingIcon}
        pending={pending}
        onClick={() => input.current?.click()}
      >
        {document ? replaceLabel : chooseLabel}
      </Button>
    </>
  );

  if (bare) {
    return (
      <>
        {control}
        {failure ? (
          <Notice tone="alert" icon="alert">
            That file did not reach the platform. {failure}
          </Notice>
        ) : null}
      </>
    );
  }

  return (
    <>
      <Dropzone
        filed={Boolean(document)}
        title={document ? document.fileName : emptyTitle}
        line={document ? undefined : emptyLine}
      >
        {control}
      </Dropzone>

      {failure ? (
        <Notice tone="alert" icon="alert">
          That file did not reach the platform. {failure}
        </Notice>
      ) : line ? (
        <Notice tone={line.tone} icon={line.icon}>
          {line.text}
        </Notice>
      ) : (
        waiting
      )}
    </>
  );
}
