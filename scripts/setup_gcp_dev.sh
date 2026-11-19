#!/usr/bin/env bash
# Setup GCP Infrastructure and Workload Identity Federation for Alpha_Insight (Bash)
# Target Project: gen-lang-client-0632004807 (asia-southeast1)

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gen-lang-client-0632004807}"
REGION="${REGION:-asia-southeast1}"
REPO_NAME="${REPO_NAME:-alpha-insight-repo}"
POOL_NAME="${POOL_NAME:-github-pool}"
PROVIDER_NAME="${PROVIDER_NAME:-github-provider}"
SA_NAME="${SA_NAME:-github-actions-deployer}"
GITHUB_REPO="${GITHUB_REPO:-ferriskwan/Alpha_Insight}"

echo "=== Step 1: Setting GCP Project Context ==="
gcloud config set project "$PROJECT_ID"

echo "=== Step 2: Enabling Required GCP APIs ==="
gcloud services enable \
    run.googleapis.com \
    sqladmin.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    iamcredentials.googleapis.com \
    cloudbuild.googleapis.com \
    --project "$PROJECT_ID"

echo "=== Step 3: Creating Artifact Registry Repository ==="
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="Docker repository for Alpha_Insight web and batch jobs" \
        --project="$PROJECT_ID"
    echo "Created Artifact Registry repository: $REPO_NAME"
else
    echo "Artifact Registry repository already exists."
fi

echo "=== Step 4: Creating GitHub Actions Service Account ==="
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="GitHub Actions Deployer" \
        --project="$PROJECT_ID"
    echo "Created Service Account: $SA_EMAIL"
else
    echo "Service account $SA_EMAIL already exists."
fi

echo "=== Step 5: Binding IAM Roles to Service Account ==="
ROLES=(
    "roles/run.admin"
    "roles/artifactregistry.writer"
    "roles/cloudsql.client"
    "roles/secretmanager.secretAccessor"
    "roles/iam.serviceAccountUser"
)

for role in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$role" \
        --condition=None \
        --quiet >/dev/null
    echo "Granted $role to $SA_EMAIL"
done

echo "=== Step 6: Configuring Workload Identity Federation (WIF) ==="
if ! gcloud iam workload-identity-pools describe "$POOL_NAME" --location="global" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools create "$POOL_NAME" \
        --location="global" \
        --display-name="GitHub Actions Pool" \
        --project="$PROJECT_ID"
    echo "Created Workload Identity Pool: $POOL_NAME"
else
    echo "Workload Identity Pool $POOL_NAME already exists."
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
    --workload-identity-pool="$POOL_NAME" \
    --location="global" \
    --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
        --location="global" \
        --workload-identity-pool="$POOL_NAME" \
        --display-name="GitHub Provider" \
        --issuer-uri="https://token.actions.githubusercontent.com" \
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
        --project="$PROJECT_ID"
    echo "Created Workload Identity Provider: $PROVIDER_NAME"
else
    echo "Workload Identity Provider $PROVIDER_NAME already exists."
fi

echo "=== Step 7: Authorizing GitHub Repository Impersonation ==="
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
WIF_POOL_RESOURCE="projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_NAME"
WIF_PROVIDER_FULL="$WIF_POOL_RESOURCE/providers/$PROVIDER_NAME"

gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/$WIF_POOL_RESOURCE/attribute.repository/$GITHUB_REPO" \
    --project="$PROJECT_ID" \
    --quiet >/dev/null

echo "Authorized repository $GITHUB_REPO to impersonate $SA_EMAIL"

echo "=== Step 8: Ensuring Secret Manager Placeholders Exist ==="
SECRETS=(
    "alpha-db-password-dev"
    "alpha-db-password"
    "alpha-gemini-api-key"
    "alpha-twelvedata-api-key"
    "alpha-google-client-id"
    "alpha-api-key-dev"
    "alpha-api-key"
)

for s in "${SECRETS[@]}"; do
    if ! gcloud secrets describe "$s" --project="$PROJECT_ID" >/dev/null 2>&1; then
        echo "Creating secret placeholder: $s"
        echo -n "" | gcloud secrets create "$s" --data-file=- --project="$PROJECT_ID"
    fi
done

echo ""
echo "========================================================"
echo "GCP Setup Complete! Set these in GitHub Repository Variables:"
echo "Repo Settings -> Secrets and variables -> Actions -> Variables"
echo "--------------------------------------------------------"
echo "WIF_PROVIDER = $WIF_PROVIDER_FULL"
echo "WIF_SERVICE_ACCOUNT = $SA_EMAIL"
echo "========================================================"
