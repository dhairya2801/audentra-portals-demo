import {paths} from './icon-paths.js';
import {PEOPLE,TYPES,stageFor} from './data.js';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function icon(name,size=16,cls=''){return `<svg class="icon icon-${name} ${cls}" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${(paths[name]||paths.circle).map(d=>`<path d="${d}"/>`).join('')}</svg>`;}
export function avatar(id,size=''){const p=PEOPLE[id];return `<span class="avatar ${p?.color||'teal'} ${size}" title="${esc(p?.name||id)}">${id==='EG'?icon('robot',16):esc(p?id:id.split(' ').map(s=>s[0]).slice(0,2).join(''))}</span>`;}
export const typeIcon=type=>`<span class="type-icon ${TYPES[type].color}" title="${TYPES[type].name}">${icon(TYPES[type].icon,13)}</span>`;
export const badge=(text,tone='gray')=>`<span class="badge ${tone}">${esc(text)}</span>`;
export function statusBadge(task){const s=stageFor(task);return badge(s.name,{todo:'gray',active:'blue',warning:'amber',done:'green'}[s.category]);}
export function priority(task){return `<span class="priority ${task.priority.toLowerCase()}" title="${task.priority} priority">${icon(task.priority==='Urgent'?'rise':task.priority==='High'?'rise':task.priority==='Low'?'fall':'flat',14)}${esc(task.priority)}</span>`;}
export const btn=(label,action,cls='',ico='')=>`<button class="btn ${cls}" data-action="${action}">${ico?icon(ico):''}${esc(label)}</button>`;
export const ib=(ico,label,action,cls='')=>`<button class="icon-btn ${cls}" data-action="${action}" title="${esc(label)}" aria-label="${esc(label)}">${icon(ico,18)}</button>`;
export const date=(at,withTime=false)=>new Date(at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',...(withTime?{hour:'numeric',minute:'2-digit'}:{})});
export const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
let timer;
export function toast(text){const el=document.querySelector('#toast');el.innerHTML=`${icon('check',18)}<span>${esc(text)}</span>`;if(el.showPopover&&!el.matches(':popover-open'))el.showPopover();el.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>{el.classList.remove('visible');el.hidePopover?.();},4500);}
export function field(label,input){return `<label class="form-field"><span>${label}</span>${input}</label>`;}
