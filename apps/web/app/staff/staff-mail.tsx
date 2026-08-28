"use client";

import type {
  StaffIdentityProvider,
  StaffMailbox,
  StaffMailMessage,
} from "@vv/contracts";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import {
  ApiClientError,
  disconnectStaffMailbox,
  getRecentStaffMail,
  getStaffMailboxes,
  searchStaffMail,
  staffMailboxConnectUrl,
} from "../lib/api-client";
import { useTenant } from "../components/tenant-provider";

function mailError(error: unknown) {
  return error instanceof ApiClientError
    ? error.message
    : "The mailbox request could not be completed.";
}

function messageDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value)) : "";
}

export function StaffMailView({ staffEmail }: { staffEmail: string }) {
  const tenant = useTenant();
  const [mailboxes, setMailboxes] = useState<StaffMailbox[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<StaffMailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await getStaffMailboxes(signal);
      setMailboxes(result.items);
      if (!result.items.some((mailbox) => mailbox.canRead)) setMessages([]);
      setSelectedId((current) =>
        result.items.some((mailbox) => mailbox.id === current)
          ? current
          : (result.items.find((mailbox) => mailbox.canRead)?.id ?? ""),
      );
      setError(null);
    } catch (reason) {
      if (!signal?.aborted) setError(mailError(reason));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getStaffMailboxes(controller.signal)
      .then((result) => {
        setMailboxes(result.items);
        const firstReadable = result.items.find((mailbox) => mailbox.canRead)?.id ?? "";
        setSelectedId(firstReadable);
        if (!firstReadable) setMessages([]);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(mailError(reason));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const controller = new AbortController();
    void getRecentStaffMail(selectedId, 25, controller.signal)
      .then((result) => setMessages(result.items))
      .catch((reason) => {
        if (!controller.signal.aborted) setError(mailError(reason));
      });
    return () => controller.abort();
  }, [selectedId]);

  const connect = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const provider = String(form.get("provider")) as StaffIdentityProvider;
    const mailboxKind = String(form.get("mailboxKind")) as "personal" | "shared";
    const address = String(form.get("address") ?? "").trim();
    if (!address) return;
    window.location.assign(
      staffMailboxConnectUrl({
        provider,
        mailboxKind,
        address,
        returnTo: "/staff",
      }),
    );
  };

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    const query = String(form.get("query") ?? "").trim();
    if (!query) return;
    setBusy("search");
    try {
      const result = await searchStaffMail({ mailboxId: selectedId, query, limit: 10 });
      setMessages(result.items);
      setError(null);
    } catch (reason) {
      setError(mailError(reason));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="staff-workspace-stack staff-mail-workspace">
      <header className="staff-page-heading">
        <div>
          <p className="eyebrow">Delegated university email</p>
          <h1>Mailboxes</h1>
          <p>Read only mailboxes you are granted and connect approved personal or shared accounts.</p>
        </div>
      </header>

      <section className="staff-panel">
        <h2>Connect a mailbox</h2>
        <form className="staff-mail-connect" onSubmit={connect}>
          <label>
            Provider
            <select name="provider" defaultValue="google">
              <option value="google">Google Workspace</option>
              <option value="microsoft">Microsoft 365</option>
            </select>
          </label>
          <label>
            Access type
            <select name="mailboxKind" defaultValue="personal">
              <option value="personal">My university mailbox</option>
              <option value="shared">Approved shared mailbox</option>
            </select>
          </label>
          <label>
            Mailbox address
            <input name="address" type="email" defaultValue={staffEmail} required />
          </label>
          <button className="button button--primary" type="submit">Connect securely</button>
        </form>
        <small>Connecting email uses separate provider consent from portal sign-in.</small>
      </section>

      <section className="staff-panel">
        <div className="action-card-heading">
          <div><h2>Authorized mailboxes</h2><p>Access is enforced again by the platform on every request.</p></div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void reload();
            }}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        {loading ? <p>Loading mailbox grants...</p> : null}
        <div className="staff-mailbox-list">
          {mailboxes.map((mailbox) => (
            <article className={selectedId === mailbox.id ? "is-selected" : undefined} key={mailbox.id}>
              <button type="button" onClick={() => setSelectedId(mailbox.id)}>
                <strong>{mailbox.displayName ?? mailbox.address}</strong>
                <span>{mailbox.provider} · {mailbox.kind} · {mailbox.status}</span>
              </button>
              {mailbox.canManage ? (
                <button
                  type="button"
                  onClick={async () => {
                    setBusy(mailbox.id);
                    try {
                      await disconnectStaffMailbox(mailbox.id);
                      await reload();
                    } catch (reason) {
                      setError(mailError(reason));
                    } finally {
                      setBusy(null);
                    }
                  }}
                  disabled={busy === mailbox.id}
                >
                  Disconnect
                </button>
              ) : null}
            </article>
          ))}
          {!loading && mailboxes.length === 0 ? <p>No mailboxes are connected yet.</p> : null}
        </div>
      </section>

      {selectedId ? (
        <section className="staff-panel">
          <div className="action-card-heading">
            <div><h2>Recent mail</h2><p>The local cache is limited to seven days.</p></div>
            <form className="staff-mail-search" onSubmit={search}>
              <input name="query" aria-label="Search the full mailbox" placeholder="Search full mailbox" required />
              <button type="submit" disabled={busy === "search"}>Search provider</button>
            </form>
          </div>
          <div className="staff-mail-message-list">
            {messages.map((message, index) => (
              <article key={message.id ?? message.providerMessageId ?? `${message.sender}-${index}`}>
                <div><strong>{message.subject || "(No subject)"}</strong><time>{messageDate(message.receivedAt)}</time></div>
                <span>From {message.sender}</span>
                <p>{message.body || "No text body available."}</p>
              </article>
            ))}
            {messages.length === 0 ? <p>No recent messages are available.</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
