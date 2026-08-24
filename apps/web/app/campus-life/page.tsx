"use client";

import { useSearchParams } from "next/navigation";
import { CampusLifeView } from "../components/campus-life-view";

/** `/campus-life` is Events; `?view=clubs` is Clubs — one screen, two destinations. */
export default function CampusLifePage() {
  const params = useSearchParams();
  const tab = params.get("view") === "clubs" ? "clubs" : "events";
  return <CampusLifeView tab={tab} />;
}
