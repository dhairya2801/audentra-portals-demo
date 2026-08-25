"use client";
import type { StudentDocument } from "@vv/contracts";
import FieldGroup from "../../design-system/patterns/FieldGroup.jsx";
import Icon from "../../design-system/Icon.jsx";
import { DocumentSlot } from "../document-slot";
import { PHOTO_RULES } from "../flow";

/**
 * Step 8, optional. The photo is a document like any other on the platform,
 * filed under `other`; nobody reviews it, so the block has no state to
 * report and takes no card. No cropping: the three rules are about what the
 * photo contains, and cropping fixes none of them.
 */
export function PhotoStep({
  photo,
  onUploaded,
}: {
  photo: StudentDocument | null;
  onUploaded: (document: StudentDocument) => void;
}) {
  return (
    <>
      <FieldGroup
        footnote={
          photo ? (
            <>
              <Icon name="info" size={14} /> Saving this step confirms it. You can change the photo
              from My Documents until orientation.
            </>
          ) : null
        }
      >
        {photo ? (
          <figure className="photo-preview">
            <span className="photo-frame" aria-hidden="true">
              <Icon name="profile" size={54} weight="duotone" />
            </span>
            <figcaption>
              <strong>{photo.fileName}</strong>
              <small>This is how it will print on your card.</small>
              <DocumentSlot
                bare
                category="other"
                document={photo}
                sentOn={null}
                emptyTitle="Add your photo"
                emptyLine=""
                chooseLabel="Choose a photo"
                replaceLabel="Use a different photo"
                leadingIcon="refresh"
                waiting={null}
                onUploaded={onUploaded}
              />
            </figcaption>
          </figure>
        ) : (
          <DocumentSlot
            category="other"
            document={null}
            sentOn={null}
            emptyTitle="Add your photo"
            emptyLine="A JPEG or a PNG, at least 600 pixels on the short side."
            chooseLabel="Choose a photo"
            leadingIcon="camera"
            waiting={null}
            onUploaded={onUploaded}
          />
        )}

        <ul className="photo-rules">
          {PHOTO_RULES.map((rule) => (
            <li key={rule}>
              <Icon name="check" size={14} /> {rule}
            </li>
          ))}
        </ul>
      </FieldGroup>

      {photo ? null : (
        <p className="field-foot">
          <Icon name="clock" size={14} /> Skipping this costs you nothing but a queue at move-in.
        </p>
      )}
    </>
  );
}
