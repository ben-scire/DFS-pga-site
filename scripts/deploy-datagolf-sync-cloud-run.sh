#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required but not found. Install Google Cloud SDK first."
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-}"
if [[ -z "${PROJECT_ID}" ]]; then
  PROJECT_ID="$(gcloud config get-value project 2>/dev/null || true)"
fi

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Set PROJECT_ID or run: gcloud config set project <your-project-id>"
  exit 1
fi

REGION="${REGION:-us-central1}"
SCHEDULER_REGION="${SCHEDULER_REGION:-$REGION}"
TIME_ZONE="${TIME_ZONE:-America/New_York}"
TOUR="${TOUR:-pga}"
SCORING_MODE="${SCORING_MODE:-dfs-rules}"
DATAGOLF_CONTEST_ID="${DATAGOLF_CONTEST_ID:-week-4-valspar}"
AR_REPO="${AR_REPO:-sync-jobs}"
IMAGE_NAME="${IMAGE_NAME:-datagolf-live-sync}"
JOB_NAME="${JOB_NAME:-datagolf-live-sync}"
SCHEDULER_JOB_NAME="${SCHEDULER_JOB_NAME:-datagolf-live-sync-every-minute}"
DATAGOLF_SECRET_NAME="${DATAGOLF_SECRET_NAME:-datagolf-api-key}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-datagolf-sync-job}"
SCHEDULER_SA_NAME="${SCHEDULER_SA_NAME:-datagolf-sync-scheduler}"

DATAGOLF_API_KEY="${DATAGOLF_API_KEY:-}"
if [[ -z "${DATAGOLF_API_KEY}" ]]; then
  echo "Set DATAGOLF_API_KEY in your shell before running this script."
  exit 1
fi

DATAGOLF_LIVE_URL="${DATAGOLF_LIVE_URL:-https://feeds.datagolf.com/preds/live-hole-scores?tour=${TOUR}&file_format=json&key={key}}"
DATAGOLF_TOURNAMENT_STATS_URL="${DATAGOLF_TOURNAMENT_STATS_URL:-}"

if [[ "${DATAGOLF_LIVE_URL}" == *"{key}}"* ]]; then
  echo "DATAGOLF_LIVE_URL looks malformed (contains '{key}}'). Remove the extra '}'."
  exit 1
fi

if [[ -n "${DATAGOLF_TOURNAMENT_STATS_URL}" && "${DATAGOLF_TOURNAMENT_STATS_URL}" == *"{key}}"* ]]; then
  echo "DATAGOLF_TOURNAMENT_STATS_URL looks malformed (contains '{key}}'). Remove the extra '}'."
  exit 1
fi

if [[ "${DATAGOLF_LIVE_URL}" == *"["*"]"* ]]; then
  echo "DATAGOLF_LIVE_URL still contains docs placeholders (e.g. [round]). Use a concrete URL."
  exit 1
fi

if [[ -n "${DATAGOLF_TOURNAMENT_STATS_URL}" && "${DATAGOLF_TOURNAMENT_STATS_URL}" == *"["*"]"* ]]; then
  echo "DATAGOLF_TOURNAMENT_STATS_URL still contains docs placeholders (e.g. [round]). Use a concrete URL."
  exit 1
fi

RUNTIME_SA_EMAIL="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SCHEDULER_SA_EMAIL="${SCHEDULER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${AR_REPO}/${IMAGE_NAME}:latest"
JOB_RUN_URI="https://run.googleapis.com/v2/projects/${PROJECT_ID}/locations/${REGION}/jobs/${JOB_NAME}:run"

ENV_VARS="^@^DATAGOLF_CONTEST_ID=${DATAGOLF_CONTEST_ID}@DATAGOLF_LIVE_URL=${DATAGOLF_LIVE_URL}@DATAGOLF_SCORING_MODE=${SCORING_MODE}"
if [[ -n "${DATAGOLF_TOURNAMENT_STATS_URL}" ]]; then
  ENV_VARS="${ENV_VARS}@DATAGOLF_TOURNAMENT_STATS_URL=${DATAGOLF_TOURNAMENT_STATS_URL}"
fi

echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Scheduler region: ${SCHEDULER_REGION}"
echo "Image: ${IMAGE_URI}"
echo "Job: ${JOB_NAME}"
echo "Scheduler job: ${SCHEDULER_JOB_NAME}"

echo "Enabling required APIs..."
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com

echo "Ensuring Artifact Registry repo exists..."
if ! gcloud artifacts repositories describe "${AR_REPO}" --location "${REGION}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format docker \
    --location "${REGION}" \
    --description "Images for Data Golf sync jobs"
fi

echo "Ensuring service accounts exist..."
if ! gcloud iam service-accounts describe "${RUNTIME_SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${RUNTIME_SA_NAME}" \
    --display-name "Data Golf Sync Runtime"
fi

if ! gcloud iam service-accounts describe "${SCHEDULER_SA_EMAIL}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SCHEDULER_SA_NAME}" \
    --display-name "Data Golf Sync Scheduler"
fi

echo "Granting runtime and scheduler IAM roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${RUNTIME_SA_EMAIL}" \
  --role "roles/datastore.user" \
  --quiet

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member "serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role "roles/run.developer" \
  --quiet

echo "Creating/updating Data Golf API key secret..."
if ! gcloud secrets describe "${DATAGOLF_SECRET_NAME}" >/dev/null 2>&1; then
  gcloud secrets create "${DATAGOLF_SECRET_NAME}" --replication-policy automatic
fi
printf '%s' "${DATAGOLF_API_KEY}" | gcloud secrets versions add "${DATAGOLF_SECRET_NAME}" --data-file=-

echo "Building and pushing worker image..."
TMP_CLOUDBUILD="$(mktemp)"
trap 'rm -f "${TMP_CLOUDBUILD}"' EXIT
cat > "${TMP_CLOUDBUILD}" <<EOF
steps:
  - name: gcr.io/cloud-builders/docker
    args:
      - build
      - -f
      - Dockerfile.datagolf-sync
      - -t
      - ${IMAGE_URI}
      - .
images:
  - ${IMAGE_URI}
EOF

gcloud builds submit \
  --project "${PROJECT_ID}" \
  --config "${TMP_CLOUDBUILD}" \
  "${REPO_DIR}"

echo "Deploying Cloud Run Job..."
gcloud run jobs deploy "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE_URI}" \
  --service-account "${RUNTIME_SA_EMAIL}" \
  --command npm \
  --args run,sync:datagolf:scores,--,--once,--contest-id,${DATAGOLF_CONTEST_ID} \
  --set-env-vars "${ENV_VARS}" \
  --set-secrets "DATAGOLF_API_KEY=${DATAGOLF_SECRET_NAME}:latest" \
  --task-timeout 900s \
  --max-retries 1 \
  --tasks 1 \
  --execute-now \
  --wait

echo "Ensuring scheduler can run the job..."
gcloud run jobs add-iam-policy-binding "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --member "serviceAccount:${SCHEDULER_SA_EMAIL}" \
  --role "roles/run.invoker" \
  --quiet

echo "Creating/updating Cloud Scheduler job..."
if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" --location "${SCHEDULER_REGION}" >/dev/null 2>&1; then
  gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" \
    --location "${SCHEDULER_REGION}" \
    --schedule "*/1 * * * *" \
    --time-zone "${TIME_ZONE}" \
    --uri "${JOB_RUN_URI}" \
    --http-method POST \
    --oauth-service-account-email "${SCHEDULER_SA_EMAIL}" \
    --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform" \
    --update-headers "Content-Type=application/json" \
    --message-body '{}'
else
  gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" \
    --location "${SCHEDULER_REGION}" \
    --schedule "*/1 * * * *" \
    --time-zone "${TIME_ZONE}" \
    --uri "${JOB_RUN_URI}" \
    --http-method POST \
    --oauth-service-account-email "${SCHEDULER_SA_EMAIL}" \
    --oauth-token-scope "https://www.googleapis.com/auth/cloud-platform" \
    --headers "Content-Type=application/json" \
    --message-body '{}'
fi

echo "Deployment complete."
echo "Manual run: gcloud run jobs execute ${JOB_NAME} --region ${REGION} --wait"
echo "Tail logs:  gcloud run jobs executions list --job ${JOB_NAME} --region ${REGION}"
