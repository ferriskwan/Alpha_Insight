import subprocess
import sys
import json

PROJECT_ID = "gen-lang-client-0632004807"
REGION = "asia-southeast1"
REPO_NAME = "alpha-insight-repo"
POOL_NAME = "github-pool"
PROVIDER_NAME = "github-provider"
SA_NAME = "github-actions-deployer"
GITHUB_REPO = "ferriskwan/Alpha_Insight"

def run(cmd, check=True, input=None):
    print(f"\n>> Running: {' '.join(cmd)}")
    res = subprocess.run(cmd, input=input, capture_output=True, text=True, shell=False)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(f"[STDERR] {res.stderr.strip()}")
    if check and res.returncode != 0:
        print(f"FAILED with exit code {res.returncode}")
        sys.exit(res.returncode)
    return res

print("=== Step 1: Setting GCP Project Context ===")
run(["gcloud.cmd", "config", "set", "project", PROJECT_ID])

print("=== Step 2: Enabling Required GCP APIs ===")
run([
    "gcloud.cmd", "services", "enable",
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com",
    "iamcredentials.googleapis.com",
    "cloudbuild.googleapis.com",
    "--project", PROJECT_ID,
])

print("=== Step 3: Ensuring Artifact Registry Repository Exists ===" )
res = run([
    "gcloud.cmd", "artifacts", "repositories", "describe",
    REPO_NAME, "--location", REGION, "--project", PROJECT_ID,
], check=False)

if res.returncode != 0:
    run([
        "gcloud.cmd", "artifacts", "repositories", "create", REPO_NAME,
        "--repository-format=docker",
        "--location", REGION,
        "--description=Docker repository for Alpha_Insight web and batch jobs",
        "--project", PROJECT_ID,
    ])
else:
    print("Artifact Registry repository already exists.")

print("=== Step 4: Ensuring GitHub Actions Service Account Exists ===")
SA_EMAIL = f"{SA_NAME}@{PROJECT_ID}.iam.gserviceaccount.com"
res = run([
    "gcloud.cmd", "iam", "service-accounts", "describe",
    SA_EMAIL, "--project", PROJECT_ID,
], check=False)

if res.returncode != 0:
    run([
        "gcloud.cmd", "iam", "service-accounts", "create", SA_NAME,
        "--display-name=GitHub Actions Deployer",
        "--project", PROJECT_ID,
    ])
else:
    print(f"Service Account {SA_EMAIL} already exists.")

print("=== Step 5: Binding IAM Roles to Service Account ===")
roles = [
    "roles/run.admin",
    "roles/artifactregistry.writer",
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/iam.serviceAccountUser",
]

for r in roles:
    run([
        "gcloud.cmd", "projects", "add-iam-policy-binding", PROJECT_ID,
        f"--member=serviceAccount:{SA_EMAIL}",
        f"--role={r}",
        "--condition=None",
        "--quiet",
    ])

print("=== Step 6: Configuring Workload Identity Pool & Provider ===")
res = run([
    "gcloud.cmd", "iam", "workload-identity-pools", "describe",
    POOL_NAME, "--location=global", "--project", PROJECT_ID,
], check=False)

if res.returncode != 0:
    run([
        "gcloud.cmd", "iam", "workload-identity-pools", "create", POOL_NAME,
        "--location=global",
        "--display-name=GitHub Actions Pool",
        "--project", PROJECT_ID,
    ])
else:
    print(f"Workload Identity Pool {POOL_NAME} already exists.")

res = run([
    "gcloud.cmd", "iam", "workload-identity-pools", "providers", "describe",
    PROVIDER_NAME,
    f"--workload-identity-pool={POOL_NAME}",
    "--location=global",
    "--project", PROJECT_ID,
], check=False)

if res.returncode != 0:
    run([
        "gcloud.cmd", "iam", "workload-identity-pools", "providers", "create-oidc",
        PROVIDER_NAME,
        f"--workload-identity-pool={POOL_NAME}",
        "--location=global",
        "--display-name=GitHub Provider",
        "--issuer-uri=https://token.actions.githubusercontent.com",
        "--attribute-mapping=google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository",
        f"--attribute-condition=assertion.repository == '{GITHUB_REPO}'",
        "--project", PROJECT_ID,
    ])
else:
    print(f"Workload Identity Provider {PROVIDER_NAME} already exists.")

print("=== Step 7: Authorizing GitHub Repository Impersonation ===")
res = run(["gcloud.cmd", "projects", "describe", PROJECT_ID, "--format=value(projectNumber)"])
PROJECT_NUMBER = res.stdout.strip()
WIF_POOL_RESOURCE = f"projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/{POOL_NAME}"
WIF_PROVIDER_FULL = f"{WIF_POOL_RESOURCE}/providers/{PROVIDER_NAME}"

run([
    "gcloud.cmd", "iam", "service-accounts", "add-iam-policy-binding", SA_EMAIL,
    "--role=roles/iam.workloadIdentityUser",
    f"--member=principalSet://iam.googleapis.com/{WIF_POOL_RESOURCE}/attribute.repository/{GITHUB_REPO}",
    "--project", PROJECT_ID,
    "--quiet",
])

print("=== Step 8: Ensuring Secret Manager Placeholders Exist ===")
secrets = [
    "alpha-db-password-dev",
    "alpha-db-password",
    "alpha-gemini-api-key",
    "alpha-twelvedata-api-key",
    "alpha-google-client-id",
    "alpha-api-key-dev",
    "alpha-api-key",
]

for s in secrets:
    res = run([
        "gcloud.cmd", "secrets", "describe", s, "--project", PROJECT_ID,
    ], check=False)
    if res.returncode != 0:
        print(f"Creating secret placeholder: {s}")
        run([
            "gcloud.cmd", "secrets", "create", s,
            "--data-file=-",
            "--project", PROJECT_ID,
        ], input="")

print("\n=== Step 9: Setting GitHub Repository Variables ===")
run([
    "gh", "variable", "set", "WIF_PROVIDER",
    "--body", WIF_PROVIDER_FULL,
    "--repo", GITHUB_REPO,
])

run([
    "gh", "variable", "set", "WIF_SERVICE_ACCOUNT",
    "--body", SA_EMAIL,
    "--repo", GITHUB_REPO,
])

print("\n========================================================")
print("SUCCESS: GCP Setup & GitHub Variables Configured!")
print(f"WIF_PROVIDER = {WIF_PROVIDER_FULL}")
print(f"WIF_SERVICE_ACCOUNT = {SA_EMAIL}")
print("========================================================")
