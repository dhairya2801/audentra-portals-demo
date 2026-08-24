"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { CampusLifeView } from "../../../components/campus-life-view";
import { useTenant } from "../../../components/tenant-provider";

/**
 * A club by its own route — the deep link. The reference opens a club in
 * `CampusDrawer` over the Clubs list, so this route renders that: the list with
 * the drawer already open on the club. Closing the drawer returns to the list.
 */
export default function ClubDetailPage() {
  const params = useParams<{ clubId: string }>();
  const router = useRouter();
  const { href } = useTenant();
  const back = useCallback(() => {
    router.replace(href("/campus-life?view=clubs"));
  }, [href, router]);

  return <CampusLifeView tab="clubs" openClubId={params.clubId} onClubClosed={back} />;
}
