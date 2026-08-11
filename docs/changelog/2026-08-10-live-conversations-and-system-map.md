# Live support conversations and system map - 2026-08-10

## Live support UX

The student Help page now listens for support-specific durable realtime hints
and refetches the server-confirmed conversation. A staff member uses the
Messages workspace to see the complete thread, including clearly marked
staff-only notes, then sends a student-safe reply through the same canonical
record.

The page advertises the real lifecycle: each participant message keeps the
thread active for five days; after that a new request is required. The portal
does not destroy a typed response on a conflict or delivery error.

## Engineering documentation boundary

The architecture map is not a staff product feature. The portal contains no
**System map** navigation item or architecture route. The canonical selectable
SVG explorer is a standalone employee-onboarding document in the platform
repository at `docs/architecture/audentra-system-flow-explorer.html`. It
provides six real scenarios:

- live support conversations;
- transcript upload, parsing, and human recovery;
- Action Center outcome and AI enrichment;
- deterministic scheduled outreach;
- conditional enrollment/onboarding journeys; and
- staff-managed content publication.

Each scenario highlights the path between Student portal, Staff portal,
Platform API, PostgreSQL/object storage, and workers/providers. Selecting any
node describes the data read/written and the corresponding safety guarantee.
This keeps engineering explanations close to the architecture documentation
and out of the student/staff runtime. It intentionally links to owning source
paths and never pretends the diagram is an executable workflow.

## Kubernetes web workload

The portal Kubernetes folder has a standard Kustomize base and GKE/EKS image
overlays. The Next.js image must be built with its public API and site URLs;
changing those only on a Deployment cannot rewrite a compiled browser bundle.
The generic manifest deliberately leaves ingress controller, certificate, DNS,
and cloud identity policy to environment overlays.
