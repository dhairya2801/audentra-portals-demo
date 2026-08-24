"use client";

import type { StudentAppointment, StudentAppointmentType } from "@vv/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import { PortalShell } from "../components/portal-shell";
import { useTenant } from "../components/tenant-provider";
import { useApiResource } from "../hooks/use-api-resource";
import { getStudentAppointments } from "../lib/api-client";
import Card, { CardHead, CardRows } from "../design-system/primitives/Card.jsx";
import InfoModal from "../design-system/patterns/InfoModal.jsx";
import PageError from "../design-system/patterns/PageError.jsx";
import PageSkeleton from "../design-system/patterns/PageSkeleton.jsx";
import StateCard from "../design-system/patterns/StateCard.jsx";
import ToastStack from "../design-system/patterns/Toast.jsx";
import { useToasts } from "../design-lib/toast.js";
import { onHandoff, takeHandoff } from "../design-lib/door.js";
import { AppointmentsBookingDrawer } from "../components/appointments-booking-drawer";
import { AppointmentsDrawer } from "../components/appointments-drawer";
import { AppointmentsRail } from "../components/appointments-rail";
import { AppointmentsRow } from "../components/appointments-row";
import { AppointmentsTopicRow } from "../components/appointments-topic-row";
import {
  type ConversationType,
  articled,
  conversationTypes,
  splitAppointments,
  typeById,
} from "../components/appointments-logic";

/**
 * Appointments — the reference's `AppointmentsPage` over the production appointment record.
 *
 *   - A topic is chosen first, because the topic decides which team receives it.
 *   - The backend publishes no times: the student chooses one in the booking drawer, and only a
 *     confirmed API response adds the conversation to the list. There is no optimistic row.
 *   - *Your conversations* and *Past and cancelled* are the product's disclosure; the first
 *     starts open, the second closed, and the choice is remembered the way the reference does.
 */

const GROUPS_STORE = "aster.appointments.groups";
const GROUPS_DEFAULT = { conversations: true, record: false };

function readGroups(): typeof GROUPS_DEFAULT {
  try {
    const raw = window.localStorage.getItem(GROUPS_STORE);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? { ...GROUPS_DEFAULT, ...parsed } : GROUPS_DEFAULT;
  } catch {
    return GROUPS_DEFAULT;
  }
}

function isAppointmentType(value: unknown): value is StudentAppointmentType {
  return conversationTypes.some((type) => type.id === value);
}

type Booking = { type: ConversationType; prefill: { subject?: string } | null };

export default function AppointmentsPage() {
  const { tenant } = useTenant();
  const appointments = useApiResource(useCallback((signal: AbortSignal) => getStudentAppointments(signal), []));
  const refresh = appointments.refresh;
  const { toasts, push, dismiss } = useToasts();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [how, setHow] = useState(false);
  const [groups, setGroups] = useState(GROUPS_DEFAULT);
  const [now, setNow] = useState(() => Date.now());
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Read after mount: the server render has no storage, and the first paint must match it.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGroups(readGroups());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(GROUPS_STORE, JSON.stringify(groups));
    } catch {
      // A portal that cannot remember a preference still has to work.
    }
  }, [groups]);

  const openBooking = useCallback((type: ConversationType, node: HTMLElement | null, prefill: Booking["prefill"] = null) => {
    returnFocus.current = node;
    setOpen(null);
    setBooking({ type, prefill });
  }, []);

  // What Edward's escalation sent her here to do arrives with what she already told him: a
  // booking opens the drawer on that team with the question written. Read once, then gone.
  useEffect(() => {
    function consume() {
      const handoff = takeHandoff("booking");
      if (handoff && isAppointmentType(handoff.topic)) {
        openBooking(typeById(handoff.topic), null, {
          subject: typeof handoff.question === "string" ? handoff.question : "",
        });
      }
    }
    consume();
    return onHandoff(consume);
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
    push({ tone: "success", title: "Booked.", body: `${articled(type.team, true)} has it too.` });
    refresh();
  }

  function bookAgain(appointment: StudentAppointment, node: HTMLElement | null = null) {
    openBooking(typeById(appointment.type), node, { subject: appointment.notes ?? "" });
  }

  function toggleGroup(id: keyof typeof GROUPS_DEFAULT) {
    setGroups((value) => ({ ...value, [id]: !value[id] }));
  }

  const list = appointments.data?.items ?? [];
  const { current, record } = splitAppointments(list, now);
  const conversationsOpen = groups.conversations;
  const openRecord = list.find((item) => item.id === open) ?? null;
  // The band points at the first topic when nothing is booked — and at nothing once one is.
  const band = current.length === 0 ? conversationTypes[0].id : null;

  return (
    <PortalShell
      active="appointments"
      rail={<AppointmentsRail institution={tenant.shortName} onOpenHow={() => setHow(true)} />}
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
              note="What it’s about"
              aside={
                <button type="button" className="text-button" onClick={() => setHow(true)}>
                  How this works
                </button>
              }
            />
            <CardRows className="topic-list">
              {conversationTypes.map((type) => (
                <AppointmentsTopicRow
                  key={type.id}
                  type={type}
                  mark="E"
                  band={band === type.id ? "start" : null}
                  onChoose={(entry, node) => openBooking(entry, node)}
                />
              ))}
            </CardRows>
          </Card>

          <Card className={current.length > 0 && !conversationsOpen ? "collapsed" : ""} aria-labelledby="conversations-heading">
            <CardHead
              kind="status"
              icon="users"
              title="Your conversations"
              titleId="conversations-heading"
              count={current.length > 0 ? current.length : undefined}
              open={conversationsOpen}
              onToggle={current.length > 0 ? () => toggleGroup("conversations") : undefined}
              controls="appointments-conversations"
            />

            {current.length === 0 ? (
              <StateCard
                icon="calendar"
                title="Nothing booked yet"
                action={{
                  label: "Book a conversation",
                  icon: "arrow",
                  onClick: (event: React.MouseEvent<HTMLButtonElement>) => openBooking(conversationTypes[0], event.currentTarget),
                }}
              >
                You haven’t booked time with any of {tenant.shortName}’s teams. Picking a topic and a time books
                it straight away. If you are not sure who to ask, ask Edward — he can point you to the right
                team.
              </StateCard>
            ) : (
              <CardRows className="appointment-list" id="appointments-conversations" hidden={!conversationsOpen}>
                {current.map((appointment) => (
                  <AppointmentsRow
                    key={appointment.id}
                    appointment={appointment}
                    type={typeById(appointment.type)}
                    tenant={tenant}
                    now={now}
                    onOpen={openAppointment}
                    onBookAgain={bookAgain}
                  />
                ))}
              </CardRows>
            )}
          </Card>

          {record.length > 0 && (
            <Card className={groups.record ? "" : "collapsed"} aria-labelledby="record-heading">
              <CardHead
                kind="status"
                icon="clock"
                tone="locked"
                title="Past and cancelled"
                titleId="record-heading"
                count={record.length}
                open={groups.record}
                onToggle={() => toggleGroup("record")}
                controls="appointments-record"
              />
              <CardRows className="appointment-list" id="appointments-record" hidden={!groups.record}>
                {record.map((appointment) => (
                  <AppointmentsRow
                    key={appointment.id}
                    appointment={appointment}
                    type={typeById(appointment.type)}
                    tenant={tenant}
                    now={now}
                    onOpen={openAppointment}
                    onBookAgain={bookAgain}
                  />
                ))}
              </CardRows>
            </Card>
          )}
        </>
      )}

      {booking && (
        <AppointmentsBookingDrawer
          type={booking.type}
          tenant={tenant}
          now={now}
          prefill={booking.prefill}
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
        />
      )}

      {how && <InfoModal variant="booking" onClose={() => setHow(false)} />}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </PortalShell>
  );
}
