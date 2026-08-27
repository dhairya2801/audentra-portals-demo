# 2026-08-27 — release candidate: My desk removed, demo personas fixed

`main` ← `integration/mock-university-v1` (fast-forward), then:

* **My desk removed from the Staff Portal.** `apps/web/app/staff/my-desk.tsx`
  deleted; `staff-portal.tsx` loses the `my_desk` view, its navigation entry,
  its page heading copy and its render branch; the `Staff · My desk` block and
  the `.staff-desk-*` selectors leave `globals.css`. `#my_desk` in the URL now
  falls through to the default view like any unknown hash. The API client's
  `getStaffMe` / `getStaffCaseload` / `getStaffAppointments` /
  `updateStaffAppointment` and the platform's staff/advising model stay.
* **Demo sign-in panels follow the platform's persona allowlist.**
  `GET /v1/auth/demo/personas` (`DemoPersonas` in `@vv/contracts`). Restricted:
  the student panel is a "Continue as <student>" button per allowlisted
  student and the staff panel lists the allowlisted chairs without search or
  filters. Open (development): both panels are unchanged. The platform enforces
  the list; the panels only draw it.

Tests: My-desk absence and navigation/view consistency in
`tests/rendered-html.test.mjs`; restricted-mode rendering in
`tests/demo-student-login.test.mjs` and `tests/demo-staff-login.test.mjs`.
