/**
 * The developer affordance for opening the staff portal as a chosen staff
 * member of the demo university.
 *
 * The synthetic staff side has ninety people with real, differing situations
 * — an overloaded adviser, one on leave, a director, someone falling behind.
 * Testing the product from their chairs means signing in as a *particular*
 * one without remembering ninety passwords, which is what this panel exists
 * for — and which is not something a staff portal should ever offer in
 * production.
 *
 * Nothing here is a security control. The platform disables
 * `/v1/auth/demo/staff/directory` and `/v1/auth/demo/staff/sign-in-as`
 * outside development and preview, refuses to resolve a demo staff session
 * when development flows are off, and resolves every reference inside the
 * authenticated tenant. This module only decides whether to draw the box.
 */

/** Same shape as the student gate: one pattern per repo. */
export function demoStaffLoginEnabled(env: {
  NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED?: string;
  NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED?: string;
  NODE_ENV?: string;
}): boolean {
  const flag = env.NEXT_PUBLIC_DEMO_STAFF_LOGIN_ENABLED?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  // A deployment that opted into the student panel gets the staff one too;
  // both open the same demo university.
  const student = env.NEXT_PUBLIC_DEMO_STUDENT_LOGIN_ENABLED?.trim().toLowerCase();
  if (student === "true") return true;
  if (student === "false") return false;
  return env.NODE_ENV === "development";
}

export type DemoStaffFilter = "all" | "can_sign_in" | "advisers" | "leaders" | "away";

/** The directory as the panel groups it: by component, people who can be opened first. */
export function groupDemoStaff<
  T extends {
    component: string;
    name: string;
    roleCode: string;
    employmentStatus: string;
    canSignIn: boolean;
    directReports: number;
  },
>(entries: T[], filter: DemoStaffFilter): Array<{ component: string; people: T[] }> {
  const matches = (entry: T) => {
    if (filter === "can_sign_in") return entry.canSignIn;
    if (filter === "advisers") return /advis/i.test(entry.roleCode);
    if (filter === "leaders") return entry.directReports > 0 || /director|vp|manager/i.test(entry.roleCode);
    if (filter === "away") return entry.employmentStatus !== "active";
    return true;
  };
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    if (!matches(entry)) continue;
    const list = groups.get(entry.component) ?? [];
    list.push(entry);
    groups.set(entry.component, list);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([component, people]) => ({
      component,
      people: people.sort((a, b) => Number(b.canSignIn) - Number(a.canSignIn) || a.name.localeCompare(b.name)),
    }));
}
