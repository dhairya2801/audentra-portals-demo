"use client";

import Icon from "../design-system/Icon.jsx";

export interface EdwardHistoryItem {
  id: string;
  title: string;
  /** Conversation turns, excluding the local greeting. */
  count: number;
  saved: boolean;
}

const EMPTY_HISTORY = {
  title: "No conversations yet",
  body: "Anything you ask Edward is kept here, so you can come back to an answer without asking again.",
};

/**
 * The fuller form — the reference history pane. On a wide window it sits
 * beside the conversation; below the two-pane width it replaces it and the
 * head grows a back control.
 */
export function EdwardHistory({
  conversations,
  activeId,
  disabled,
  onOpen,
  onNew,
}: {
  conversations: EdwardHistoryItem[];
  activeId: string;
  disabled: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const saved = conversations.filter((item) => item.count > 0);

  return (
    <div className="edward-history">
      <p className="panel-label">Your conversations</p>

      {saved.length === 0 ? (
        <div className="edward-history-empty">
          <span className="state-icon">
            <Icon name="message" size={20} />
          </span>
          <strong>{EMPTY_HISTORY.title}</strong>
          <p>{EMPTY_HISTORY.body}</p>
        </div>
      ) : (
        <ul className="edward-history-list">
          {saved.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={item.id === activeId ? "active" : ""}
                aria-current={item.id === activeId ? "true" : undefined}
                disabled={disabled}
                onClick={() => onOpen(item.id)}
              >
                <strong>{item.title}</strong>
                <span>
                  {item.count} {item.count === 1 ? "message" : "messages"}
                  {item.saved ? " · saved to your record" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        className="edward-new-conversation"
        disabled={disabled}
        onClick={onNew}
      >
        <Icon name="pen" size={15} /> New conversation
      </button>
    </div>
  );
}
