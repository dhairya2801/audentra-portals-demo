"use client";

import { useState } from "react";
import Icon from "../design-system/Icon.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";

const steps = [
  { icon: "spark", title: "Small steps. Real rewards.", copy: "Complete enrollment tasks to earn points toward bookstore credit. Your momentum card shows what you have earned and what is available today.", sample: "Your progress has perks", detail: "Open How points work to see the conversion rate and try an example of how available points decrease each day. Your earned points remain yours." },
  { icon: "flow", title: "A clear path forward.", copy: "Smart order brings important deadlines and steps that unlock other tasks to the top. Choose Due soon for deadlines, or Fastest when you have a few minutes.", sample: "Start here → unlock your next steps", detail: "Time estimates describe your effort. University review can take longer." },
  { icon: "checklist", title: "Know what to expect.", copy: "Every task has a How this works guide. See what to prepare, follow the steps, and find out what happens after you submit.", sample: "Prepare → submit → university review", detail: "In review means you have done your part. Action needed means something needs your attention again." },
  { icon: "spark", title: "A little help from Edward.", copy: "Ask Edward from a task to get guidance about that specific step. Your question starts with the task’s context, so you do not need to explain everything again.", sample: "What do I need for this task?", detail: "Look for the E beside a task or in the corner of your portal." },
  { icon: "users", title: "There is a person behind your portal.", copy: "Your enrollment contact can help when you need a person. Email your team, send a message, or book a conversation from Appointments.", sample: "Your team. Your next step.", detail: "You can replay this guide any time from My Enrollment." },
];
export function EnrollmentTour({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  return <InfoModal kicker={`YOUR ENROLLMENT GUIDE · ${index+1} OF ${steps.length}`} icon={step.icon} title={step.title} onClose={onClose}>
    <p>{step.copy}</p>
    <div className="enrollment-tour-preview"><Icon name={step.icon} size={34} /><strong>{step.sample}</strong><p>{step.detail}</p></div>
    <div className="tour-footer"><div className="tour-dots" aria-label="Guide progress">{steps.map((item,i)=><button type="button" key={item.title} aria-label={`Step ${i+1}: ${item.title}`} aria-current={index===i?"step":undefined} onClick={()=>setIndex(i)} />)}</div><div><button type="button" className="text-button" disabled={!index} onClick={()=>setIndex(index-1)}>Back</button><button type="button" className="primary-button" onClick={()=>index===steps.length-1?onClose():setIndex(index+1)}>{index===steps.length-1?"Let’s get started":"Next"}<Icon name="arrow" size={16}/></button></div></div>
  </InfoModal>;
}
