"use client";

import { useEffect, useState } from "react";
import { getStudentRequirements } from "../lib/api-client";
import type { EdwardSuggestionGroup } from "../components/edward-thread";

const initial: EdwardSuggestionGroup[] = [
  {
    id: "start",
    label: "Start with what matters",
    items: [
      { id: "next", text: "What should I focus on next?" },
      { id: "account", text: "Does my balance need attention?" },
      { id: "people", text: "Who can help me with my classes?" },
      { id: "dates", text: "Which deadlines apply to me?" },
    ],
  },
];

/** Small canonical read on opening; no model call and no sensitive empty-state dump. */
export function useEdwardSuggestions(open: boolean) {
  const [groups, setGroups] = useState(initial);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void getStudentRequirements(controller.signal)
      .then((result) => {
        const pending = result.items
          .filter(
            (item) =>
              !["completed", "waived", "not_applicable"].includes(item.status),
          )
          .slice(0, 2);
        const contextual = pending.map((item) => ({
          id: item.id,
          text: `What is the next step for “${item.title}”?`,
        }));
        setGroups([
          {
            id: "start",
            label: pending.length
              ? "From your enrollment"
              : "Start with what matters",
            items: [
              initial[0]!.items[0]!,
              ...contextual,
              ...initial[0]!.items.slice(1),
            ].slice(0, 4),
          },
        ]);
      })
      .catch(() => {
        /* Quiet fallback; suggestions are optional. */
      });
    return () => controller.abort();
  }, [open]);
  return groups;
}
