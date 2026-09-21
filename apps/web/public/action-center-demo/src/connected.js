import {boardRequest} from './identities.js';
import {esc,avatar,date,icon} from './ui.js';

// Drafts and retry receipts live only in this tab; canonical messages never use browser storage.
export const drafts = new Map();
const attempts = new Map();
const pending = new Set();
export async function command(key, operation, payload) {
  if (pending.has(key)) throw Error('This action is already being saved.');
  const fingerprint = JSON.stringify(payload, (name,value) => ['expectedVersion','expectedWorkItemVersion'].includes(name) ? undefined : value);
  let attempt = attempts.get(key);
  if (!attempt || attempt.fingerprint !== fingerprint) {
    attempt = {fingerprint, payload:structuredClone(payload), idempotencyKey:crypto.randomUUID()};
    attempts.set(key, attempt);
  }
  pending.add(key);
  try {
    const result = await boardRequest(operation, {...attempt.payload,idempotencyKey:attempt.idempotencyKey});
    attempts.delete(key);
    return result;
  } catch (error) {
    // A confirmed conflict did not commit; retry after the canonical version refresh.
    if (['VERSION_CONFLICT','SUPPORT_CONVERSATION_EXPIRED','CONVERSATION_ACTIVE'].includes(error.code)) attempts.delete(key);
    throw error;
  } finally { pending.delete(key); }
}
export function conversation(t, {compact=false}={}) {
  const thread=t.conversations?.[0], messages=thread?.messages||[];
  return `<section class="content-section"><div class="section-heading"><h3>Conversation</h3><span>${esc(t.student)} · Student portal</span></div>
    ${!compact?`<div class="conversation">${messages.map(m=>`<div class="message-bubble ${m.direction==='student'?'incoming':'outgoing'}"><div>${avatar(m.direction==='student'?t.student:'ML','small')}<strong>${esc(m.authorName)}</strong><time>${date(m.createdAt,true)}</time></div><p>${esc(m.body)}</p><small>Student portal</small></div>`).join('')||'<p class="muted">No messages yet.</p>'}</div>`:''}
    ${thread?.expired?'<p class="subtle-note">This conversation expired after five days without messages. Sending below starts a new conversation; the history is retained.</p>':''}
    <form id="connected-message-form"><label class="form-field"><span>Message to ${esc(t.preferredName)}</span><textarea name="portalMessage" aria-label="Portal message" rows="3" maxlength="500" required>${esc(drafts.get(t.id)||'')}</textarea></label><div class="composer-footer"><span class="muted">Delivered to the student portal</span><button class="btn primary" type="submit">${icon('send',15)}${thread?.expired?'Start new conversation':'Send message'}</button></div></form>
    ${t.conversations?.length>1?`<details><summary>Earlier conversations (${t.conversations.length-1})</summary>${t.conversations.slice(1).map(c=>c.messages.map(m=>`<p><strong>${esc(m.authorName)}</strong> · ${date(m.createdAt,true)}<br>${esc(m.body)}</p>`).join('')).join('')}</details>`:''}
  </section>`;
}
