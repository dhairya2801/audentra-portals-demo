"use client";
import {useState} from "react";
import Icon from "../design-system/Icon.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import {useTenant} from "./tenant-provider";
import {formatTenantDate} from "../lib/tenant";

export const supportServices = [
 {id:'student_accounts',name:'Student Accounts',team:'Student Accounts team',icon:'card',copy:'Payment plans, a question about your bill, or receiving a refund.',purpose:['Understand my bill','Plan a payment','Discuss a refund'],private:false},
 {id:'counseling',name:'Counseling & emotional wellbeing',team:'Counseling team',icon:'heart',copy:'A supportive conversation about stress, change or finding your balance.',purpose:['An initial conversation','A follow-up conversation'],private:true},
 {id:'student_health',name:'Student health',team:'Student Health team',icon:'health',copy:'Connect with campus health services and learn how to prepare for a visit.',purpose:['Connect with the health team','Ask about visit preparation'],private:true},
 {id:'accessibility',name:'Accessibility & accommodations',team:'Accessibility Services',icon:'shield',copy:'Talk through the support that helps you participate fully in college life.',purpose:['Discuss accommodations','Review an existing arrangement'],private:true},
 {id:'career',name:'Career planning',team:'Career Services',icon:'graduation',copy:'Explore a direction, prepare for interviews or take the next step toward an internship.',purpose:['Explore career paths','Review my résumé','Prepare for an interview'],private:false},
 {id:'testing',name:'Testing services',team:'Testing Center',icon:'checklist',copy:'Placement testing, exam arrangements and help finding the right testing appointment.',purpose:['Placement test planning','Exam arrangements'],private:false},
];
export type SupportService = typeof supportServices[number];
export function SupportServiceBooking({service,onClose}:{service:SupportService;onClose:()=>void}) {
 const {tenant}=useTenant();
 const [purpose,setPurpose]=useState(service.purpose[0]);
 const [day,setDay]=useState(0),[time,setTime]=useState('10:00 AM'),[done,setDone]=useState(false),[joined,setJoined]=useState(false);
 const [dates]=useState(()=>{const result:Date[]=[];const d=new Date();d.setHours(12,0,0,0);while(result.length<5){d.setDate(d.getDate()+1);if(d.getDay()!==0&&d.getDay()!==6)result.push(new Date(d));}return result;});
 return <InfoModal title={joined?'Your conversation space':done?'Your time, set aside.':service.name} kicker="BOOKING PREVIEW · SAMPLE AVAILABILITY" icon="calendar" onClose={onClose}>
  {done?<div className="support-confirmation"><span className="support-confirmation-mark"><Icon name={joined?'users':'check'} size={28}/></span><h3>{service.team}</h3><p>{purpose}</p><p>{formatTenantDate(dates[day],tenant,{weekday:'long',month:'long',day:'numeric'})} · {time} · 30 minutes</p><p>{joined?'This is a preview of your online meeting space. A real meeting link will come from the team.':'This example has not booked a real appointment or notified a team.'}</p><div className="support-preview-actions">{!joined&&<button type="button" className="primary-button" onClick={()=>setJoined(true)}>Preview meeting room →</button>}<button type="button" className="secondary-button" onClick={()=>{setDone(false);setJoined(false);}}>Choose another time</button></div></div>:<>
   <p>{service.copy}</p><div className="meeting-owner"><span className="meeting-owner-avatar">{service.team.split(' ').slice(0,2).map(s=>s[0]).join('')}</span><span><strong>{service.team}</strong><small>30-minute introductory conversation</small></span></div>
   {service.private&&<div className="support-privacy"><Icon name="shield" size={18}/><div><strong>Start with a conversation.</strong><p>No medical records, diagnosis or disability details are requested here. The specialist team will explain its confidential process and secure document channel.</p></div></div>}
   <div className="support-slot-picker"><div><span className="panel-label">CHOOSE A DAY</span><div className="support-days">{dates.map((date,i)=><button type="button" key={i} aria-pressed={day===i} onClick={()=>setDay(i)}><small>{formatTenantDate(date,tenant,{weekday:'short'})}</small><strong>{formatTenantDate(date,tenant,{day:'numeric'})}</strong><span>{formatTenantDate(date,tenant,{month:'short'})}</span></button>)}</div></div><div><span className="panel-label">CHOOSE A TIME</span><div className="support-times">{['10:00 AM','11:30 AM','1:00 PM','2:30 PM'].map(slot=><button type="button" key={slot} aria-pressed={time===slot} onClick={()=>setTime(slot)}>{slot}</button>)}</div></div></div>
   <p className="meta">Times shown in {tenant.localization.timeZone}. Sample slots for this service.</p>
   <label className="support-purpose">What would you like help with?<select value={purpose} onChange={event=>setPurpose(event.target.value)}>{service.purpose.map(purpose=><option key={purpose}>{purpose}</option>)}</select></label>
   <button type="button" className="primary-button full" onClick={()=>setDone(true)}>Preview this appointment →</button>
  </>}
 </InfoModal>;
}
