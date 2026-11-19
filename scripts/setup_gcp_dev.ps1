# Setup GCP Infrastructure and Workload Identity Federation for Alpha_Insight (PowerShell)
# Target Project: gen-lang-client-0632004807 (asia-southeast1)

param(
    [string]$ProjectId = "gen-lang-client-0632004807",
    [string]$Region = "asia-southeast1",
    [string]$RepoName = "alpha-insight-repo",
    [string]$PoolName = "github-pool",
    [string]$ProviderName = "github-provider",
    [string]$SaName = "github-actions-deployer",
    [string]$GithubRepo = "ferriskwan/Alpha_Insight"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Step 1: Setting GCP Project Context ===" -ForegroundColor Cyan
gcloud config set project $ProjectId

Write-Host "=== Step 2: Enabling Required GCP APIs ===" -ForegroundColor Cyan
gcloud services enable `
    run.googleapis.com `
    sqladmin.googleapis.com `
    artifactregistry.googleapis.com `
    secretmanager.googleapis.com `
    iamcredentials.googleapis.com `
    cloudbuild.googleapis.com `
    --project $ProjectId

Write-Host "=== Step 3: Creating Artifact Registry Repository ===" -ForegroundColor Cyan
$repoExists = gcloud artifacts repositories list --location=$Region --format="value(name)" --filter="name:$RepoName"
if (-not $repoExists) {
    gcloud artifacts repositories create $RepoName `
        --repository-format=docker `
        --location=$Region `
        --description="Docker repository for Alpha_Insight web and batch jobs" `
        --project=$ProjectId
    Write-Host "Created Artifact Registry repository: $RepoName" -ForegroundColor Green
} else {
    Write-Host "Artifact Registry repository already exists." -ForegroundColor Yellow
}

Write-Host "=== Step 4: Creating GitHub Actions Service Account ===" -ForegroundColor Cyan
$SaEmail = "$SaName@$ProjectId.iam.gserviceaccount.com"
$saExists = gcloud iam service-accounts list --format="value(email)" --filter="email:$SaEmail"
if (-not $saExists) {
    gcloud iam service-accounts create $SaName `
        --display-name="GitHub Actions Deployer" `
        --project=$ProjectId
    Write-Host "Created Service Account: $SaEmail" -ForegroundColor Green
} else {
    Write-Host "Service account $SaEmail already exists." -ForegroundColor Yellow
}

Write-Host "=== Step 5: Binding IAM Roles to Service Account ===" -ForegroundColor Cyan
$roles = @(
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountUser"
)

foreach ($r in $roles) {
    gcloud projects add-iam-policy-binding $ProjectId `
        --member="serviceAccount:$SaEmail" `
        --role=$r `
        --condition=None `
        --quiet | Out-Null
    Write-Host "Granted $r to $SaEmail" -ForegroundColor Green
}

Write-Host "=== Step 6: Configuring Workload Identity Federation (WIF) ===" -ForegroundColor Cyan
$poolExists = gcloud iam workload-identity-pools list --location=global --format="value(name)" --filter="name:$PoolName"
if (-not $poolExists) {
    gcloud iam workload-identity-pools create $PoolName `
        --location="global" `
        --display-name="GitHub Actions Pool" `
        --project=$ProjectId
    Write-Host "Created Workload Identity Pool: $PoolName" -ForegroundColor Green
} else {
    Write-Host "Workload Identity Pool $PoolName already exists." -ForegroundColor Yellow
}

$providerExists = gcloud iam workload-identity-pools providers list `
    --workload-identity-pool=$PoolName `
    --location=global `
    --format="value(name)" `
    --filter="name:$ProviderName"

if (-not $providerExists) {
    gcloud iam workload-identity-pools providers create-oidc $ProviderName `
        --location="global" `
        --workload-identity-pool=$PoolName `
        --display-name="GitHub Provider" `
        --issuer-uri="https://token.actions.githubusercontent.com" `
        --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" `
        --project=$ProjectId
    Write-Host "Created Workload Identity Provider: $ProviderName" -ForegroundColor Green
} else {
    Write-Host "Workload Identity Provider $ProviderName already exists." -ForegroundColor Yellow
}

Write-Host "=== Step 7: Authorizing GitHub Repository Impersonation ===" -ForegroundColor Cyan
$ProjectNumber = gcloud projects describe $ProjectId --format="value(projectNumber)"
$WifPoolResource = "projects/$ProjectNumber/locations/global/workloadIdentityPools/$PoolName"
$WifProviderFull = "$WifPoolResource/providers/$ProviderName"

gcloud iam service-accounts add-iam-policy-binding $SaEmail `
    --role="roles/iam.workloadIdentityUser" `
    --member="principalSet://iam.googleapis.com/$WifPoolResource/attribute.repository/$GithubRepo" `
    --project=$ProjectId `
    --quiet | Out-Null

Write-Host "Authorized repository $GithubRepo to impersonate $SaEmail" -ForegroundColor Green

Write-Host "=== Step 8: Ensuring Secret Manager Placeholders Exist ===" -ForegroundColor Cyan
$secrets = @(
    "alpha-db-password-dev",
    "alpha-db-password",
    "alpha-gemini-api-key",
    "alpha-twelvedata-api-key",
    "alpha-google-client-id",
    "alpha-api-key-dev",
    "alpha-api-key"
)

foreach ($s in $secrets) {
    $secExists = gcloud secrets list --format="value(name)" --filter="name:$s" --project=$ProjectId
    if (-not $secExists) {
        Write-Host "Creating secret placeholder: $s (remember to set version payload)" -ForegroundColor Yellow
        "" | gcloud secrets create $s --data-file=- --project=$ProjectId
    }
}

Write-Host "`n========================================================" -ForegroundColor Magenta
Write-Host "GCP Setup Complete! Set these in GitHub Repository Variables:" -ForegroundColor Magenta
Write-Host "Repo Settings -> Secrets and variables -> Actions -> Variables" -ForegroundColor Magenta
Write-Host "--------------------------------------------------------" -ForegroundColor Magenta
Write-Host "WIF_PROVIDER = $WifProviderFull" -ForegroundColor Cyan
Write-Host "WIF_SERVICE_ACCOUNT = $SaEmail" -ForegroundColor Cyan
Write-Host "========================================================`n" -ForegroundColor Magenta
