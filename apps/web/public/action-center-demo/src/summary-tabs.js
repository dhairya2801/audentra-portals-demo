import { icon } from './ui.js';
export const SUMMARY_VIEWS=[['overview','chart','Overview'],['board','columns','Board'],['focus','rows','Focus'],['portfolio','records','Portfolio']];
export function viewTabs(current,prefix){
 return `<div class="fy-view-tabs" role="tablist" aria-label="For You views">${SUMMARY_VIEWS.map(([id,mark,label])=>`<button type="button" id="${prefix}-view-${id}" role="tab" aria-selected="${current===id}" aria-controls="${prefix}-panel" tabindex="${current===id?'0':'-1'}" data-summary-view="${id}">${icon(mark,15)}<span>${label}</span></button>`).join('')}</div>`;
}
