"use client";

import { useEffect, useId, useState } from "react";

type DateTimePickerProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  autoComplete?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  min?: string;
  name?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  required?: boolean;
  value?: string;
};

type DateTimeParts = {
  date: string;
  time: string;
};

function splitDateTime(value = ""): DateTimeParts {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function serializeDateTime(date: string, time: string) {
  return date ? date + "T" + (time || "09:00") : "";
}

/**
 * A form-friendly date and time control. The date segment uses the browser's
 * native calendar view while the hidden input preserves the existing
 * datetime-local value submitted by the API forms.
 */
export function DateTimePicker({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  autoComplete,
  defaultValue,
  disabled,
  id,
  min,
  name,
  onBlur,
  onChange,
  required,
  value,
}: DateTimePickerProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [selection, setSelection] = useState(() => splitDateTime(value ?? defaultValue));
  const isControlled = value !== undefined;

  useEffect(() => {
    if (isControlled) setSelection(splitDateTime(value));
  }, [isControlled, value]);

  const commit = (date: string, time: string) => {
    const next = { date, time };
    setSelection(next);
    onChange?.(serializeDateTime(date, time));
  };

  const minimumDate = min?.slice(0, 10);
  const minimumTime =
    selection.date && selection.date === minimumDate ? min?.slice(11, 16) : undefined;

  return (
    <span className="date-time-picker">
      {name ? (
        <input
          type="hidden"
          name={name}
          value={serializeDateTime(selection.date, selection.time)}
          disabled={disabled}
        />
      ) : null}
      <input
        id={inputId}
        className="date-time-picker__date"
        type="date"
        value={selection.date}
        min={minimumDate}
        autoComplete={autoComplete}
        required={required}
        disabled={disabled}
        aria-label="Date"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        onChange={(event) => {
          const date = event.target.value;
          commit(date, date ? selection.time || "09:00" : "");
        }}
      />
      <input
        className="date-time-picker__time"
        type="time"
        value={selection.time}
        min={minimumTime}
        required={required}
        disabled={disabled}
        aria-label="Time"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        onChange={(event) => commit(selection.date, event.target.value)}
      />
    </span>
  );
}
