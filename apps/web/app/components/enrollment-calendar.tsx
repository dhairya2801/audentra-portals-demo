"use client";
import {useState} from "react";
import type {StudentRequirementDetail} from "@vv/contracts";
import Icon from "../design-system/Icon.jsx";
import {useTenant} from "./tenant-provider";
import {formatTenantDate} from "../lib/tenant";

export function EnrollmentCalendar({items,onOpen}:{items:StudentRequirementDetail[];onOpen:(item:StudentRequirementDetail)=>void}) {
 const {tenant}=useTenant();
 const due=items.filter(item=>item.dueAt&&!['completed','waived','not_applicable'].includes(item.status)).sort((a,b)=>Date.parse(a.dueAt!)-Date.parse(b.dueAt!));
 const [month,setMonth]=useState(()=>{const date=new Date(due[0]?.dueAt||Date.now());return new Date(date.getFullYear(),date.getMonth(),1);});
 const [selected,setSelected]=useState<number|null>(null);
 const key=(iso:string)=>formatTenantDate(iso,tenant,{year:'numeric',month:'2-digit',day:'2-digit'});
 const atDay=(day:number)=>due.filter(item=>key(item.dueAt!)===key(new Date(month.getFullYear(),month.getMonth(),day,12).toISOString()));
 const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 const shown=selected?atDay(selected):due.slice(0,4);
 return <section className="enrollment-dates">
  <div className="enrollment-dates-head"><Icon name="calendar" size={19}/><h2>Your Enrollment Calendar</h2></div>
  <div className="enrollment-calendar-nav"><button type="button" aria-label="Previous month" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()-1,1));setSelected(null);}}>←</button><strong>{month.toLocaleDateString('en-US',{month:'long',year:'numeric'})}</strong><button type="button" aria-label="Next month" onClick={()=>{setMonth(new Date(month.getFullYear(),month.getMonth()+1,1));setSelected(null);}}>→</button></div>
  <div className="enrollment-month" aria-label="Enrollment deadlines">
   {['S','M','T','W','T','F','S'].map((day,index)=><span key={'label'+index} aria-hidden="true">{day}</span>)}
   {Array.from({length:month.getDay()},(_,i)=><span key={'empty'+i}/>)}
   {Array.from({length:count},(_,i)=>{const day=i+1,tasks=atDay(day);return <button type="button" key={day} aria-pressed={selected===day} aria-label={`${month.toLocaleDateString('en-US',{month:'long'})} ${day}, ${tasks.length} deadlines`} className={tasks.length?'has-deadline':''} onClick={()=>setSelected(selected===day?null:day)}>{day}{tasks.length>0&&<i/>}</button>;})}
  </div>
  <div className="calendar-list-label"><span>{selected?`Due on ${month.toLocaleDateString('en-US',{month:'short'})} ${selected}`:'Next deadlines'}</span>{selected&&<button type="button" onClick={()=>setSelected(null)}>Show all</button>}</div>
  {shown.map(item=><button type="button" className="enrollment-calendar-task" key={item.id} onClick={()=>onOpen(item)}><span className="enrollment-date-tile"><small>{formatTenantDate(item.dueAt!,tenant,{month:'short'})}</small><b>{formatTenantDate(item.dueAt!,tenant,{day:'numeric'})}</b></span><span><strong>{item.title}</strong><small>{item.status==='blocked'?'View prerequisites':item.status==='rejected'?'Update your submission':'See what to prepare'}</small></span><Icon name="arrow" size={14}/></button>)}
  {!shown.length&&<p>No deadlines on {selected?'this day':'your calendar'}. A little breathing room.</p>}
 </section>;
}
