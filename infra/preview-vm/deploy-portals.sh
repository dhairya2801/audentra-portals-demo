#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this deployment command through sudo." >&2
  exit 1
fi

if [[ "$#" -ne 1 || ! "$1" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: audentra-portals-deploy <40-character git commit SHA>" >&2
  exit 64
fi

release_id="$1"
registry_host="us-central1-docker.pkg.dev"
image_uri="${registry_host}/even-advantage-502610-n1/audentra-portals/web:${release_id}"
release_archive="/tmp/audentra-portals-release-${release_id}.tar.gz"
release_root="/opt/audentra-portals/releases"
shared_root="/opt/audentra-portals/shared"
release_dir="${release_root}/${release_id}"
current_link="/opt/audentra-portals/current"
environment_file="${shared_root}/.env"
deployment_file="${shared_root}/deployment.env"
next_deployment_file="${deployment_file}.next"
lock_file="/run/lock/audentra-preview-deploy.lock"

exec 9>"$lock_file"
if ! flock -w 900 9; then
  echo "Timed out waiting for another Audentra preview deployment to finish." >&2
  exit 75
fi

for required_file in "$release_archive" "$environment_file"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Required deployment file is missing: ${required_file}" >&2
    exit 66
  fi
done

while IFS= read -r entry; do
  if [[ -z "$entry" || "$entry" == /* || "$entry" == ".." || "$entry" == ../* || "$entry" == */../* ]]; then
    echo "Unsafe release archive entry rejected: ${entry}" >&2
    exit 65
  fi
done < <(tar -tzf "$release_archive")

previous_release=""
if [[ -L "$current_link" ]]; then
  previous_release="$(readlink -f "$current_link")"
fi

rm -rf "$release_dir"
install -d -m 0750 -o root -g root "$release_dir"
tar -xzf "$release_archive" --directory "$release_dir" --no-same-owner --no-same-permissions
if find "$release_dir" -type l -print -quit | grep -q .; then
  echo "Release archives containing symbolic links are not accepted." >&2
  rm -rf "$release_dir"
  exit 65
fi
if [[ ! -f "$release_dir/infra/preview-vm/compose.yaml" ]]; then
  echo "The portals preview Compose file is missing from the release." >&2
  exit 66
fi

docker_config="$(mktemp -d)"
trap 'rm -rf "$docker_config"' EXIT
registry_token="$(
  curl --fail --silent --show-error --connect-timeout 5 --max-time 15 \
    -H 'Metadata-Flavor: Google' \
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token' \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])'
)"
printf '%s' "$registry_token" \
  | docker --config "$docker_config" login \
      --username oauth2accesstoken --password-stdin "$registry_host" >/dev/null
# Docker does not prune images used by running containers. Reclaiming only
# unused images before a pull protects the active release (and its rollback
# path) while preventing the small preview VM's image cache from blocking a
# new, otherwise safe release.
docker image prune --all --force >/dev/null || true
docker --config "$docker_config" pull "$image_uri"
docker image inspect "$image_uri" >/dev/null

if ! docker network inspect audentra-preview >/dev/null 2>&1; then
  docker network create audentra-preview >/dev/null
fi
docker volume create vv-edgent-preview_caddy-data >/dev/null
docker volume create vv-edgent-preview_caddy-config >/dev/null

printf 'PORTALS_IMAGE_URI=%s\n' "$image_uri" >"$next_deployment_file"
chmod 0600 "$next_deployment_file"
chown root:root "$next_deployment_file"
chmod 0600 "$environment_file"
chown root:root "$environment_file"

compose=(
  docker compose
  --project-name audentra-portals-preview
  --env-file "$environment_file"
  --env-file "$next_deployment_file"
  --file "$release_dir/infra/preview-vm/compose.yaml"
)

legacy_was_running=0
legacy_compose=()
if [[ -n "$(docker ps --quiet --filter name=vv-edgent-preview-caddy-1)" ]]; then
  legacy_was_running=1
  legacy_release="$(readlink -f /opt/vv-edgent/current 2>/dev/null || true)"
  if [[ -n "$legacy_release" && -f "$legacy_release/infra/preview-vm/compose.yaml" ]]; then
    legacy_compose=(
      docker compose
      --env-file /opt/vv-edgent/shared/.env
      --env-file /opt/vv-edgent/shared/deployment.env
      --file "$legacy_release/infra/preview-vm/compose.yaml"
    )
    "${legacy_compose[@]}" down
  fi
fi

deployment_failed=0
"${compose[@]}" up -d --no-build || deployment_failed=1
if [[ "$deployment_failed" -eq 0 ]]; then
  for _ in $(seq 1 60); do
    web_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' audentra-portals-preview-web-1 2>/dev/null || true)"
    caddy_health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' audentra-portals-preview-caddy-1 2>/dev/null || true)"
    if [[ "$web_health" == "healthy" && "$caddy_health" == "healthy" ]]; then
      deployment_failed=0
      break
    fi
    deployment_failed=1
    sleep 2
  done
fi

site_host="$(grep -m1 '^SITE_HOST=' "$environment_file" | cut -d= -f2-)"
if [[ "$deployment_failed" -eq 0 ]]; then
  curl --fail --silent --show-error --max-time 15 \
    --resolve "${site_host}:443:127.0.0.1" \
    "https://${site_host}/health/ready" >/dev/null || deployment_failed=1
  curl --fail --silent --show-error --max-time 15 \
    --resolve "${site_host}:443:127.0.0.1" \
    "https://${site_host}/" >/dev/null || deployment_failed=1
fi

if [[ "$deployment_failed" -ne 0 ]]; then
  echo "Portals health check failed; restoring the previous edge release." >&2
  "${compose[@]}" logs --tail=200 web caddy >&2 || true
  "${compose[@]}" down || true
  if [[ -n "$previous_release" && -d "$previous_release" && -f "$deployment_file" ]]; then
    rollback_compose=(
      docker compose
      --project-name audentra-portals-preview
      --env-file "$environment_file"
      --env-file "$deployment_file"
      --file "$previous_release/infra/preview-vm/compose.yaml"
    )
    "${rollback_compose[@]}" up -d --no-build || true
  elif [[ "$legacy_was_running" -eq 1 && "${#legacy_compose[@]}" -gt 0 ]]; then
    "${legacy_compose[@]}" up -d --no-build || true
  fi
  exit 1
fi

ln -sfn "$release_dir" "${current_link}.next"
mv -Tf "${current_link}.next" "$current_link"
mv -f "$next_deployment_file" "$deployment_file"
install -m 0755 "$release_dir/infra/preview-vm/deploy-portals.sh" /usr/local/sbin/audentra-portals-deploy

rm -f "$release_archive"
find "$release_root" -mindepth 1 -maxdepth 1 -type d ! -path "$release_dir" -printf '%T@ %p\n' |
  sort -nr | tail -n +4 | cut -d' ' -f2- | xargs --no-run-if-empty rm -rf
timeout 60 docker image prune --force >/dev/null || true

echo "Audentra portals release ${release_id} is healthy at https://${site_host}."
