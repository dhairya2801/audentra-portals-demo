"use client";

import type { StudentAppointment, StudentAppointmentType } from "@vv/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentAdvising, getStudentAppointments, getStudentOnboarding } from "../lib/api-client";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import Icon from "../design-system/Icon.jsx";
import { TenantLink as Link } from "../components/tenant-link";
import "../components/student-meeting-refresh.css";
import { useToasts } from "../design-lib/toast.js";
import { onHandoff, takeHandoff } from "../design-lib/door.js";
import { AppointmentsBookingDrawer } from "../components/appointments-booking-drawer";
import { AppointmentsDrawer } from "../components/appointments-drawer";
import { AppointmentsRow } from "../components/appointments-row";
import { supportServices, SupportServiceBooking, type SupportService } from "../components/student-support-services";
import { AppointmentsTopicRow } from "../components/appointments-topic-row";
import {
  type ConversationType,
  articled,
  conversationTypes,
  splitAppointments,
  typeById,
} from "../components/appointments-logic";

/** Topic cards, available slots and the agenda use canonical platform records.
 * Booking success enters the agenda only after confirmation and a refetch. */

function isAppointmentType(value: unknown): value is StudentAppointmentType {
  return conversationTypes.some((type) => type.id === value);
}

type Booking = {
  type: ConversationType;
  prefill: { subject?: string; staffMemberId?: string } | null;
  reschedule?: StudentAppointment | null;
};

export default function AppointmentsPage() {
  const { tenant } = useTenant();
  const appointments = useApiResource(useCallback((signal: AbortSignal) => getStudentAppointments(signal), []));
  const advising = useApiResource(useCallback((signal: AbortSignal) => getStudentAdvising(signal), []));
  const profile = useApiResource(useCallback((signal: AbortSignal) => getStudentOnboarding(signal), []));
  const [supportService, setSupportService] = useState<SupportService | null>(null);
  const [allServices, setAllServices] = useState(false);
  const refresh = appointments.refresh;
  const { toasts, push, dismiss } = useToasts();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [how, setHow] = useState(false);
  const [agendaView, setAgendaView] = useState<"upcoming" | "history">("upcoming");
  const [now, setNow] = useState(() => Date.now());
  const returnFocus = useRef<HTMLElement | null>(null);

  const openBooking = useCallback(
    (type: ConversationType, node: HTMLElement | null, prefill: Booking["prefill"] = null, reschedule: StudentAppointment | null = null) => {
      returnFocus.current = node;
      setOpen(null);
      setBooking({ type, prefill, reschedule });
    },
    [],
  );

  // What Edward's escalation sent her here to do arrives with what she already told him: a
  // booking opens the drawer on that team with the question written. Read once, then gone.
  useEffect(() => {
    function consume() {
      const handoff = takeHandoff("booking");
      if (handoff && isAppointmentType(handoff.topic)) {
        openBooking(typeById(handoff.topic), null, {
          subject: typeof handoff.question === "string" ? handoff.question : "",
        });
        return true;
      }
      return false;
    }
    // Consume browser navigation after mount, with cleanup for Strict Mode.
    const timer = window.setTimeout(() => {
      const topic = new URLSearchParams(window.location.search).get("topic");
      if (!consume() && isAppointmentType(topic)) openBooking(typeById(topic), null, {staffMemberId: new URLSearchParams(window.location.search).get("staff") || undefined});
      const service = supportServices.find(item=>item.id===topic);
      if (service) setSupportService(service);
    }, 0);
    const unsubscribe = onHandoff(consume);
    return () => { window.clearTimeout(timer); unsubscribe(); };
  }, [openBooking]);

  function closeBooking() {
    setBooking(null);
    setNow(Date.now());
    returnFocus.current?.focus();
  }

  function openAppointment(appointment: StudentAppointment, node: HTMLElement | null) {
    returnFocus.current = node;
    setOpen(appointment.id);
  }

  function closeAppointment() {
    setOpen(null);
    returnFocus.current?.focus();
  }

  function booked(appointment: StudentAppointment) {
    const type = typeById(appointment.type);
    const who = appointment.staff?.name ?? articled(type.team, true);
    push({
      tone: "success",
      title: appointment.rescheduledFromId ? "Moved." : "Booked.",
      body: `${who} has it too.`,
    });
    refresh();
    advising.refresh();
  }

  function cancelled(appointment: StudentAppointment) {
    const type = typeById(appointment.type);
    push({ tone: "info", title: "Cancelled.", body: `The time is back on ${appointment.staff?.name ?? articled(type.team)}’s calendar.` });
    setOpen(null);
    refresh();
    advising.refresh();
  }

  function reschedule(appointment: StudentAppointment) {
    openBooking(typeById(appointment.type), null, { subject: appointment.notes ?? "" }, appointment);
  }

  function bookAgain(appointment: StudentAppointment, node: HTMLElement | null = null) {
    openBooking(typeById(appointment.type), node, { subject: appointment.notes ?? "" });
  }

  const list = appointments.data?.items ?? [];
  const { current, record } = splitAppointments(list, now);
  const openRecord = list.find((item) => item.id === open) ?? null;
  // The band points at the first topic when nothing is booked — and at nothing once one is.
  const band = current.length === 0 ? conversationTypes[0].id : null;

  return (
    <PortalShell
      active="appointments"
      hero={{ title: "A conversation can change everything.", lede: "Find the right person, choose a time, and take your next step with confidence." }}
      rail={
        <div className="student-agenda">
          <div className="agenda-heading"><span className="agenda-icon"><Icon name="calendar" size={20} /></span><div><span className="panel-label">YOUR TIME, AT A GLANCE</span><h2>Your agenda</h2></div></div>
          <div className="agenda-tabs" aria-label="Appointment history">
            <button type="button" aria-pressed={agendaView === "upcoming"} onClick={() => setAgendaView("upcoming")}>Upcoming <span>{current.length}</span></button>
            <button type="button" aria-pressed={agendaView === "history"} onClick={() => setAgendaView("history")}>Past & cancelled</button>
          </div>
          {(agendaView === "upcoming" ? current : record).length ? <div className="agenda-list">{(agendaView === "upcoming" ? current : record).map(appointment => <AppointmentsRow key={appointment.id} appointment={appointment} type={typeById(appointment.type)} tenant={tenant} now={now} onOpen={openAppointment} onBookAgain={bookAgain} />)}</div> : <div className="agenda-empty"><Icon name="calendar" size={30} /><h3>{agendaView === "upcoming" ? "Make room for your next step." : "Your story starts here."}</h3><p>{agendaView === "upcoming" ? "Your upcoming conversations and meeting links will appear here once you book." : "Past and cancelled appointments stay here for reference."}</p></div>}
          <div className="agenda-help"><Icon name="help" size={18} /><div><strong>Not sure who to meet?</strong><p>We can help you find the right team.</p><Link href="/help">Find support →</Link></div></div>
        </div>
      }
    >
      {appointments.status === "loading" ? (
        <PageSkeleton label="your appointments" />
      ) : appointments.status === "error" ? (
        <PageError label="your appointments" onRetry={appointments.reload} />
      ) : (
        <>
          <Card aria-labelledby="book-heading">
            <CardHead
              kind="status"
              icon="calendar"
              tone="accent"
              title="Book a conversation"
              titleId="book-heading"
              note="Good questions deserve a real conversation."
              aside={
                <button type="button" className="text-button" onClick={() => setHow(true)}>
                  How this works
                </button>
              }
            />
            <div className="service-directory-filter"><span>Support for your next chapter</span><button type="button" aria-pressed={allServices} onClick={()=>setAllServices(!allServices)}>{allServices?"Show services for me":"See all university services"}</button></div>
            <CardRows className="topic-list">
              {conversationTypes.filter(type => allServices || (type.id !== "admissions_counseling" && (type.id !== "international_check_in" || (profile.data?.data.residencyStatus !== "domestic" && profile.data?.data.citizenshipStatus !== "us_citizen" && profile.data?.data.citizenshipStatus !== "permanent_resident")))).map((type) => (
                <AppointmentsTopicRow
                  key={type.id}
                  type={type}
                  mark="E"
                  person={type.id === "academic_advising" ? advising.data?.primaryAdviser?.staff : advising.data?.advisers.find(entry => entry.role === ({ financial_aid: "financial_aid_counselor", admissions_counseling: "admissions_counselor", enrollment_support: "admissions_counselor", international_check_in: "international_adviser" } as Record<string,string>)[type.id])?.staff}
                  band={band === type.id ? "start" : null}
                  onChoose={(entry, node) => openBooking(entry, node)}
                />
              ))}
            </CardRows>
          </Card>

          <section className="support-directory"><div className="support-directory-heading"><span className="panel-label">MORE WAYS TO FEEL SUPPORTED</span><h2>The right team for every question.</h2><p>Explore these services and try a booking preview.</p></div><div className="support-service-grid">{supportServices.map(service=><article key={service.id}><span className="support-service-icon"><Icon name={service.icon} size={22}/></span><h3>{service.name}</h3><p>{service.copy}</p><div className="meeting-owner"><span className="meeting-owner-avatar">{service.team.split(' ').slice(0,2).map(s=>s[0]).join('')}</span><span><strong>{service.team}</strong><small>{service.private?"Specialist support":"Student support"}</small></span></div><button type="button" className="secondary-button" onClick={()=>setSupportService(service)}>Explore times →</button></article>)}</div></section>

        </>
      )}

      {supportService && <SupportServiceBooking service={supportService} onClose={()=>setSupportService(null)}/> }
      {booking && (
        <AppointmentsBookingDrawer
          type={booking.type}
          tenant={tenant}
          now={now}
          prefill={booking.prefill}
          reschedule={booking.reschedule ?? null}
          onBooked={booked}
          onClose={closeBooking}
        />
      )}

      {openRecord && (
        <AppointmentsDrawer
          appointment={openRecord}
          type={typeById(openRecord.type)}
          tenant={tenant}
          now={now}
          onClose={closeAppointment}
          onBookAgain={(appointment) => bookAgain(appointment)}
          onReschedule={reschedule}
          onCancelled={cancelled}
        />
      )}

      {how && <InfoModal variant="booking" onClose={() => setHow(false)} />}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </PortalShell>
  );
}
