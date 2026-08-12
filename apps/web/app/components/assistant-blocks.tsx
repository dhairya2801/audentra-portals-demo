import type { AssistantResponseBlock } from "@vv/contracts";
import { TenantLink as Link } from "./tenant-link";

/**
 * The structured renderer for an assistant turn.
 *
 * There is no markdown path. A turn arrives either as typed blocks or as plain
 * text, and plain text keeps its existing single-paragraph rendering in the
 * assistant panel — so layout can only come from the server as data, never as
 * markup the model authored.
 *
 * The unknown-type case is deliberate rather than defensive. Every block
 * carries `fallbackText`, its own plain-text rendering, so a portal deployed
 * before a new block type existed still shows the student something true
 * instead of an empty space or a crash. New block types are therefore additive
 * on the server alone.
 */
export function AssistantBlocks({
  blocks,
  idPrefix,
}: {
  blocks: readonly AssistantResponseBlock[];
  idPrefix: string;
}) {
  return (
    <div className="assistant-blocks">
      {blocks.map((block, index) => (
        <AssistantBlockView
          block={block}
          key={`${idPrefix}-block-${index}`}
          idPrefix={`${idPrefix}-block-${index}`}
        />
      ))}
    </div>
  );
}

function AssistantBlockView({
  block,
  idPrefix,
}: {
  block: AssistantResponseBlock;
  idPrefix: string;
}) {
  switch (block.type) {
    case "text":
      return <p className="assistant-block assistant-block--text">{block.text}</p>;

    case "bullet_list":
      return (
        <section className="assistant-block assistant-block--bullets">
          {block.title ? <h4>{block.title}</h4> : null}
          <ul>
            {block.items.map((item, index) => (
              <li key={`${idPrefix}-item-${index}`}>
                {item.href ? (
                  <Link href={item.href}>{item.text}</Link>
                ) : (
                  item.text
                )}
              </li>
            ))}
          </ul>
        </section>
      );

    case "numbered_list":
    case "next_steps":
      return (
        <section className="assistant-block assistant-block--steps">
          {block.title ? <h4>{block.title}</h4> : null}
          <ol>
            {block.items.map((item, index) => (
              <li key={`${idPrefix}-item-${index}`}>
                {item.href ? (
                  <Link href={item.href}>{item.text}</Link>
                ) : (
                  item.text
                )}
                {"owner" in item && item.owner === "university" ? (
                  <span className="assistant-block__owner">
                    waiting on the university
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      );

    case "table":
      return (
        <section className="assistant-block assistant-block--table">
          {block.caption ? <h4>{block.caption}</h4> : null}
          {/* Scrolls inside itself so a wide table never scrolls the chat. */}
          <div className="assistant-block__table-scroll">
            <table>
              <thead>
                <tr>
                  {block.columns.map((column) => (
                    <th
                      key={`${idPrefix}-column-${column.key}`}
                      scope="col"
                      style={
                        column.align === "right"
                          ? { textAlign: "right" }
                          : undefined
                      }
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${idPrefix}-row-${rowIndex}`}>
                    {block.columns.map((column) => (
                      <td
                        key={`${idPrefix}-row-${rowIndex}-${column.key}`}
                        style={
                          column.align === "right"
                            ? { textAlign: "right" }
                            : undefined
                        }
                      >
                        {row[column.key] ?? "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      );

    default:
      // A block type this build does not know. Its own plain-text rendering is
      // always correct, so the student loses the formatting and nothing else.
      return (
        <p className="assistant-block assistant-block--fallback">
          {(block as { fallbackText?: string }).fallbackText ?? ""}
        </p>
      );
  }
}
