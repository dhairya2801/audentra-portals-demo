#!/usr/bin/env bash
# One-time, idempotent portal boundary provisioning for Audentra Cloud Run.
# Run only as an IAM administrator after reviewing every binding. This script
# creates no service-account key and never makes the platform API public.

set -euo pipefail

target="${1:-}"
if [[ "${target}" != "production" && "${target}" != "development" ]]; then
  echo "Usage: $0 <production|development>" >&2
  exit 2
fi

project_id="${GCP_PROJECT_ID:-audentra}"
project_number="${GCP_PROJECT_NUMBER:-906906351296}"
region="${GCP_REGION:-us-central1}"
github_owner_id="${GITHUB_OWNER_ID:-310706677}"
github_repository_id="${GITHUB_REPOSITORY_ID:?Set GITHUB_REPOSITORY_ID to the immutable Audentra-portals GitHub repository ID.}"
github_ref="refs/heads/main"
artifact_repository="audentra-portals"

if [[ "${target}" == "production" ]]; then
  github_environment="preview"
  github_pool_display_name="Audentra portals prod GitHub"
  api_service="audentra-api-preview"
  portal_service="audentra-portals-preview"
  runtime_account_name="audentra-portals-runtime"
  cd_account_name="audentra-portals-cd"
  workload_identity_pool="github-audentra-portals"
else
  github_environment="development"
  github_pool_display_name="Audentra portals dev GitHub"
  api_service="audentra-api-development"
  portal_service="audentra-portals-development"
  runtime_account_name="audentra-portals-dev-runtime"
  cd_account_name="audentra-portals-dev-cd"
  workload_identity_pool="github-audentra-portals-dev"
fi

runtime_service_account="${runtime_account_name}@${project_id}.iam.gserviceaccount.com"
cd_service_account="${cd_account_name}@${project_id}.iam.gserviceaccount.com"
workload_identity_provider="github"

gcloud projects describe "${project_id}" --format='value(projectNumber)' | grep -Fx "${project_number}" >/dev/null
gcloud run services describe "${api_service}" \
  --project="${project_id}" --region="${region}" >/dev/null

if ! gcloud artifacts repositories describe "${artifact_repository}" \
  --project="${project_id}" --location="${region}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${artifact_repository}" \
    --project="${project_id}" \
    --location="${region}" \
    --repository-format=docker \
    --description="Immutable Audentra portal images"
fi

if ! gcloud iam service-accounts describe "${runtime_service_account}" \
  --project="${project_id}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${runtime_account_name}" \
    --project="${project_id}" \
    --display-name="Audentra portals ${target} runtime"
fi
if ! gcloud iam service-accounts describe "${cd_service_account}" \
  --project="${project_id}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${cd_account_name}" \
    --project="${project_id}" \
    --display-name="Audentra portals ${target} delivery"
fi

# Bootstrap an internal-ingress service so later permissions can remain
# resource-scoped. The manual deploy switches ingress to all only while it
# installs the real portal image; the private platform keeps its existing IAM.
if ! gcloud run services describe "${portal_service}" \
  --project="${project_id}" --region="${region}" >/dev/null 2>&1; then
  gcloud run deploy "${portal_service}" \
    --project="${project_id}" \
    --region="${region}" \
    --platform=managed \
    --image=us-docker.pkg.dev/cloudrun/container/hello \
    --service-account="${runtime_service_account}" \
    --port=8080 \
    --ingress=internal \
    --min-instances=0 \
    --max-instances=1 \
    --quiet
fi

# The browser can load the portal; only the portal runtime can invoke the API.
gcloud run services add-iam-policy-binding "${portal_service}" \
  --project="${project_id}" --region="${region}" \
  --member=allUsers --role=roles/run.invoker --quiet
gcloud run services add-iam-policy-binding "${api_service}" \
  --project="${project_id}" --region="${region}" \
  --member="serviceAccount:${runtime_service_account}" \
  --role=roles/run.invoker --quiet

# Project IAM administrators can express these grants without broader
# repository- or service-account IAM administration. Resource-name conditions
# keep each otherwise project-level role constrained to its exact target.
artifact_condition="resource.name.startsWith('projects/${project_id}/locations/${region}/repositories/${artifact_repository}')"
gcloud projects add-iam-policy-binding "${project_id}" \
  --member="serviceAccount:${cd_service_account}" \
  --role=roles/artifactregistry.writer \
  --condition="expression=${artifact_condition},title=audentra_portals_${target}_artifact_only,description=Portal delivery can write only the portal repository" \
  --quiet --format=none

runtime_condition="resource.name == 'projects/${project_id}/serviceAccounts/${runtime_service_account}'"
gcloud projects add-iam-policy-binding "${project_id}" \
  --member="serviceAccount:${cd_service_account}" \
  --role=roles/iam.serviceAccountUser \
  --condition="expression=${runtime_condition},title=audentra_portals_${target}_runtime_only,description=Portal delivery can act only as its runtime identity" \
  --quiet --format=none
gcloud run services add-iam-policy-binding "${portal_service}" \
  --project="${project_id}" --region="${region}" \
  --member="serviceAccount:${cd_service_account}" \
  --role=roles/run.developer --quiet
gcloud run services add-iam-policy-binding "${api_service}" \
  --project="${project_id}" --region="${region}" \
  --member="serviceAccount:${cd_service_account}" \
  --role=roles/run.viewer --quiet

if ! gcloud iam workload-identity-pools describe "${workload_identity_pool}" \
  --project="${project_id}" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "${workload_identity_pool}" \
    --project="${project_id}" \
    --location=global \
    --display-name="${github_pool_display_name}"
fi

attribute_mapping="google.subject=assertion.sub"
attribute_mapping+=",attribute.repository_id=assertion.repository_id"
attribute_mapping+=",attribute.repository_owner_id=assertion.repository_owner_id"
attribute_mapping+=",attribute.ref=assertion.ref"
attribute_mapping+=",attribute.environment=assertion.environment"
attribute_mapping+=",attribute.event_name=assertion.event_name"
attribute_condition="assertion.repository_owner_id == '${github_owner_id}'"
attribute_condition+=" && assertion.repository_id == '${github_repository_id}'"
attribute_condition+=" && assertion.ref == '${github_ref}'"
attribute_condition+=" && assertion.environment == '${github_environment}'"
attribute_condition+=" && assertion.event_name == 'workflow_dispatch'"

if ! gcloud iam workload-identity-pools providers describe "${workload_identity_provider}" \
  --workload-identity-pool="${workload_identity_pool}" \
  --project="${project_id}" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "${workload_identity_provider}" \
    --workload-identity-pool="${workload_identity_pool}" \
    --project="${project_id}" \
    --location=global \
    --display-name="Audentra portals ${target}" \
    --issuer-uri=https://token.actions.githubusercontent.com \
    --attribute-mapping="${attribute_mapping}" \
    --attribute-condition="${attribute_condition}"
fi

principal_set="principalSet://iam.googleapis.com/projects/${project_number}"
principal_set+="/locations/global/workloadIdentityPools/${workload_identity_pool}"
principal_set+="/attribute.repository_id/${github_repository_id}"
cd_condition="resource.name == 'projects/${project_id}/serviceAccounts/${cd_service_account}'"
gcloud projects add-iam-policy-binding "${project_id}" \
  --member="${principal_set}" \
  --role=roles/iam.workloadIdentityUser \
  --condition="expression=${cd_condition},title=audentra_portals_${target}_cd_only,description=The immutable portal repository can impersonate only its delivery identity" \
  --quiet --format=none

# OAuth callback query parameters are credential-bearing. Drop the edge request
# records for only the fixed callback paths; application logs remain redacted.
callback_filter='resource.type="cloud_run_revision" AND ('
callback_filter+='httpRequest.requestUrl=~"/v1/auth/sso/(google|microsoft)/callback([?]|$)" OR '
callback_filter+='httpRequest.requestUrl=~"/v1/auth/staff/sso/(google|microsoft)/callback([?]|$)" OR '
callback_filter+='httpRequest.requestUrl=~"/v1/staff/mail/oauth/(google|microsoft)/callback([?]|$)")'
oauth_callback_log_filter_ready=false
if gcloud logging sinks describe _Default --project="${project_id}" >/dev/null 2>&1; then
  existing_exclusions="$(gcloud logging sinks describe _Default \
    --project="${project_id}" --format='value(exclusions.name)')"
  if grep -Fq 'audentra_oauth_callback_queries' <<<"${existing_exclusions}"; then
    oauth_callback_log_filter_ready=true
  elif gcloud logging sinks update _Default --help | grep -q -- '--add-exclusion'; then
    if gcloud logging sinks update _Default \
      --project="${project_id}" \
      --add-exclusion="name=audentra_oauth_callback_queries,description=Drop credential-bearing OAuth callback request URLs,filter=${callback_filter}" \
      --quiet; then
      oauth_callback_log_filter_ready=true
    else
      echo "WARNING: OAuth callback log exclusion was not installed; keep hosted SSO disabled until a logging administrator installs it." >&2
    fi
  fi
fi

echo "Provisioned ${portal_service} for manual ${target} delivery."
echo "WIF provider: projects/${project_number}/locations/global/workloadIdentityPools/${workload_identity_pool}/providers/${workload_identity_provider}"
echo "The API remains IAM-private; no service-account key was created."
if [[ "${oauth_callback_log_filter_ready}" != "true" ]]; then
  echo "Hosted SSO gate: BLOCKED until the bounded OAuth callback log exclusion is confirmed." >&2
fi
