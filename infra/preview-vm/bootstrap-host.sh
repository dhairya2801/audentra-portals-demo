#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this bootstrap command through sudo." >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
shared_root="/opt/audentra-portals/shared"
environment_file="${shared_root}/.env"
legacy_environment_file="/opt/vv-edgent/shared/.env"

read_value() {
  local name="$1"
  local file="$2"
  [[ -f "$file" ]] || return 0
  grep -m1 "^${name}=" "$file" 2>/dev/null | cut -d= -f2- || true
}

site_host="$(read_value SITE_HOST "$environment_file")"
if [[ -z "$site_host" ]]; then
  site_host="$(read_value SITE_HOST "$legacy_environment_file")"
fi
if [[ -z "$site_host" ]]; then
  echo "SITE_HOST is missing from both the current and legacy protected environments." >&2
  exit 78
fi

install -d -m 0750 -o root -g root /opt/audentra-portals/releases "$shared_root"
umask 077
printf 'SITE_HOST=%s\n' "$site_host" >"${environment_file}.next"
chmod 0600 "${environment_file}.next"
chown root:root "${environment_file}.next"
mv -f "${environment_file}.next" "$environment_file"

if ! docker network inspect audentra-preview >/dev/null 2>&1; then
  docker network create audentra-preview >/dev/null
fi
docker volume create vv-edgent-preview_caddy-data >/dev/null
docker volume create vv-edgent-preview_caddy-config >/dev/null

install -m 0755 "${script_dir}/deploy-portals.sh" /usr/local/sbin/audentra-portals-deploy
echo "Audentra portals preview host is ready."
