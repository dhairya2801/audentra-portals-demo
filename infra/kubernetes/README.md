# Audentra portals on Kubernetes

These manifests run the Next.js/React student and staff portals as a separate,
portable Kubernetes workload. The platform is deployed from the sibling
`Audentra-platform` repository; both workloads share the `audentra` namespace
by default but have independent images, services, HPA, PDB, and release order.

## What the base owns

- two web replicas behind `audentra-portals-web` on port `3000`;
- health probes, resource requests/limits, HPA, PDB, non-root/read-only
  containers, and a scoped ingress policy;
- a public web ingress template at `app.example.edu`.

The base intentionally has no cloud-specific annotations. GKE and EKS can use
the same `networking.k8s.io/v1` Ingress resource; add the selected controller's
`ingressClassName`, load-balancer annotations, DNS, and certificate integration
in an environment overlay.

## Build contract

`NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_SITE_URL` are compiled into the
portal image during `next build`. They are **not** safe to change only through
the Deployment environment after an image is built.

For a normal two-host deployment, build the web image with values such as:

```text
NEXT_PUBLIC_API_BASE_URL=https://api.example.edu
NEXT_PUBLIC_SITE_URL=https://app.example.edu
```

Set the platform's `WEB_ORIGIN=https://app.example.edu` at the same time so
credentialed browser requests and SSE connections pass CORS validation.

## Build and release order

1. Deploy and validate the compatible platform release, including migrations.
2. Build the portal image from `infra/docker/web.Dockerfile` with the public
   API/site build arguments above; publish it with an immutable SHA tag.
3. Replace the image registry/tag in either `overlays/gke` or `overlays/eks`.
4. Patch the ingress host (`app.example.edu`), TLS secret, and selected ingress
   class in the real environment overlay.
5. Render before applying:

   ```text
   kubectl kustomize infra/kubernetes/overlays/gke
   # or
   kubectl kustomize infra/kubernetes/overlays/eks
   ```

6. Apply the overlay and wait for rollout completion. Exercise a student and a
   staff session after every first release, including a live message/SSE update.

## GKE/EKS portability notes

The only provided overlay difference is registry shape: Artifact Registry for
GKE and ECR for EKS. Use workload identity/IRSA only for the CI or edge services
that need cloud APIs; the web pod itself has no runtime secret contract.

For live updates, configure the ingress/load balancer to allow long-lived SSE
responses and disable buffering on the API events endpoints. A reconnect is
safe: each portal receives a durable cursor event and refetches canonical data
from the platform rather than treating the stream as a database.

Do not add static cloud credentials, API keys, or tenant data to these
manifests. The browser-facing API URL is public configuration; all sensitive
platform configuration belongs to the platform's external secret flow.
