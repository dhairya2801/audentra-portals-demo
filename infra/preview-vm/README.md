# GCP preview deployment

This profile deploys the production Next.js image and Caddy edge to the
existing hardened Compute Engine preview VM. The FastAPI platform is deployed
independently from `Audentra-ai/Audentra-platform` onto the shared private
`audentra-preview` Docker network.

GitHub Actions builds the immutable portal image with the public HTTPS API
origin, pushes it to the immutable `audentra-portals` Artifact Registry
repository, transfers only the reviewed Compose configuration through IAP,
and invokes the root-owned deployment command. The VM pulls through its
read-only runtime service account. Caddy remains the only public container and
reuses the existing certificate volumes.

Bootstrap once from a reviewed checkout on the VM:

```bash
sudo infra/preview-vm/bootstrap-host.sh
```

The first successful portals release stops the obsolete combined-monorepo
Compose project only after the new platform is healthy. If the new web or edge
health check fails, the command restores the prior portals release or the
legacy stack during the first cutover.
