# EthnoPharma Cloud — Internal Technical Notes (Extended)

INTERNAL ONLY. Not for public distribution.

Purpose:

- Keep all operational details, deployment commands, scheduler notes, and architecture specifics out of the public README.
- Serve as the single “runbook + context” reference to resume work quickly.

================================================================================

1. # Project Intent

EthnoPharma Cloud is a long-running, autonomous, AI-assisted ethnobotanical knowledge system.

Primary goals:

- Minimal manual intervention
- Slow, controlled, high-quality data growth
- Resistance to duplication and low-confidence noise
- Predictable operational behavior
- Suitability for months/years of unattended execution

Low throughput is intentional. Stability and correctness > volume.

================================================================================ 2) What the System Does
================================================================================

- AI-assisted discovery of ethnobotanical plant candidates
- Full enrichment pipeline (sources → narrative → effects → image → affiliate)
- Multilingual text generation (RU / EN)
- Automatic posting to Telegram (via Bot API)
- ETL-style modular pipelines
- Serverless execution via Cloud Run Services (Scheduler-triggered)
- Firestore-based content state machine
- Robust normalization, validation, safety rules
- Image sourcing + attribution via iNaturalist
- Affiliate link auto-detection (iHerb etc.)
- Clean, explicit, maintainable architecture

================================================================================ 3) Repository Structure (Operational View)
================================================================================

ethnopharma-cloud/
├── src_clean/
│ ├── services/
│ │ ├── discover-candidates-clean/ # Cloud Run Service — AI discovery (Scheduler-triggered)
│ │ └── post-random-clean/ # Cloud Run Service — Telegram posting
│ │
│ ├── pipeline/ # Enrichment pipeline (local or Cloud Run-compatible)
│ │ ├── steps/ # Modular steps (find, fetch, enrich, pick image, quality gate, etc.)
│ │ ├── services/ # iNaturalist, affiliate search, image processing, scraping helpers
│ │ ├── utils/ # normalization, validation, networking, metadata
│ │ ├── config/ # allowlists, vocabularies, schemas
│ │ └── tools/ # audits, HTML cleaning, file-safe operations
│
├── tools/ # Repo-wide operational scripts
│ ├── importCandidates.js
│ ├── importEffects.js
│ ├── import_cards_ready_to_firestore.js
│ ├── updateCooldown.js
│ ├── reconcile-candidates.js
│ └── firestore_ping.mjs
│
└── Dockerfile # Optional; services deploy via --source buildpacks

Notes:

- Services currently deploy from source using Cloud Run buildpacks (recommended).
- Dockerfile can remain for portability/experimentation but is not required for current ops.

================================================================================ 4) Firestore Data Model (Conceptual)
================================================================================

Firestore (Native mode) is the single source of truth.

Collections:

A) candidates

- Output of discovery
- Input for enrichment pipeline

Typical fields:

- latin (Title Case Latin binomial)
- status (new / enriched / rejected)
- source (suggested / imported)
- addedAt / updatedAt timestamps

Rules:

- Only validated, normalized Latin binomials allowed
- Append-oriented by design (slow growth)

B) cards

- Final publishable cards
- ONLY this collection is used by posting

Simplified card shape (conceptual):

cards/{id} {
status: "ready",
postedCount: number,
lastPostedAt: timestamp | null,
payload: {
image: {
url: string | null,
license,
credit,
status
},
title: { ru, en },
summary: { ru, en },
ethnobotany,
modern_evidence,
effects: [],
affiliate: {
product_url,
url
}
}
}

================================================================================ 5) Cloud Run Services
================================================================================

A) discover-candidates-clean
Type:

- Cloud Run Service (HTTP), triggered by Cloud Scheduler

Responsibilities:

- Generate candidate plant names using OpenAI
- Normalize + validate Latin binomials
- Deduplicate against existing candidates + cards (+ history memory)
- Persist accepted candidates to Firestore

Behavior:

- added: 0 is normal and expected on a mature dataset
- duplicates are common and filtered
- correctness over throughput
- safe for long-term unattended execution

B) post-random-clean
Type:

- Cloud Run Service (HTTP), triggered by Cloud Scheduler + manual POST

Responsibilities:

- Select a publishable card
- Enforce cooldown and posting rules
- Post to Telegram RU/EN
- Update Firestore posting metadata (postedCount/lastPostedAt/etc.)

Rule:

- Only ONE posting service must be active at any time.

================================================================================ 6) Discovery Strategy (Design Rationale)
================================================================================

Discovery constraints:

- Strict Latin binomial validation
- Exclude all known species (existing candidates + cards)
- Exclude historical discovery attempts (history memory)
- Ethnobotanical relevance (medicinal/ritual use in named traditions/regions)
- Avoid purely culinary/ornamental/industrial plants without documented medicinal/ritual use
- Avoid toxic/dangerous species

Anti-stagnation:

- Rotate semantic contexts (regions/traditions/perspectives) to avoid repeatedly hitting the same suggestion space.

Why it must still be “documentable”:

- Downstream enrichment requires sources; candidates that are too obscure will fail later.
- Discovery should balance novelty with “findability” in credible sources.

================================================================================ 7) Why added: 0 Is Expected
================================================================================

On a sufficiently populated dataset:

- Many runs produce 0 new candidates
- Occasional runs produce 1–2 candidates

This is healthy behavior.

The system intentionally avoids:

- low-confidence suggestions
- hallucinated or undocumented species
- unverifiable or noisy entries

Success criteria:

- new candidates appear over multi-week windows, not necessarily daily.

================================================================================ 8) Known Issues and Decisions (Current State)
================================================================================

A) Broken images (legacy tail)
Observed reasons:

- missing_or_not_string: cards created when the image source was unavailable at the time
- http_not_ok 404: iNaturalist image removed later (not a pipeline bug)

Conclusion:

- Current pipeline does not continuously produce broken images
- Remaining broken images are legacy and non-blocking

Mitigation:

- Manual fixes tracked externally (Google Keep)

Optional future improvement:

- If image is 404 → allow posting without image (fallback)

B) Affiliate (iHerb)

- All cards have affiliate URL
- Many are search URLs → can resolve to empty search results (UX issue, not a pipeline bug)

Optional improvement:

- Distinguish product URL vs search URL and store explicitly

C) RU/EN mismatch edge cases

- Rare semantic mismatch in RU/EN naming can happen
- Not planning mass validation (edge-case, not systemic)

================================================================================ 9) Deployment (Current: Deploy from Source)
================================================================================

Services deploy via buildpacks (Cloud Run --source).

Deploy discover-candidates-clean:
gcloud run deploy discover-candidates-clean \
 --source src_clean/services/discover-candidates-clean \
 --region me-west1 \
 --allow-unauthenticated

Deploy post-random-clean:
gcloud run deploy post-random-clean \
 --source src_clean/services/post-random-clean \
 --region me-west1 \
 --allow-unauthenticated

Notes:

- Do NOT deploy discover-candidates-clean as Cloud Functions Gen2 here; it is a Cloud Run Service.
- Cloud Functions deployment can produce IAM/actAs issues and naming collisions with existing Cloud Run services.

================================================================================ 10) Scheduler Operations
================================================================================

Scheduler triggers services via HTTP POST.

Key rule:

- Keep only one active posting schedule (post-random-clean)
- Pause or delete old posting schedules to avoid:
  - double posting
  - quota waste
  - exceeding “parallel free services” limits

When creating Scheduler jobs:

- Use time zone: Asia/Jerusalem
- Use correct region for scheduler job (e.g., europe-west1 if that’s where you manage them)
- Ensure URI points to the correct Cloud Run Service URL
- Prefer OIDC auth (service account) if required by your setup

Example (pattern):
gcloud scheduler jobs create http <job-name> \
 --schedule="0 9 \* \* \*" \
 --time-zone="Asia/Jerusalem" \
 --uri="https://<service>-<hash>.me-west1.run.app/" \
 --http-method=POST \
 --headers="Content-Type=application/json" \
 --message-body="{}" \
 --oidc-service-account-email="1015913391381-compute@developer.gserviceaccount.com" \
 --location=europe-west1

================================================================================ 11) Manual Testing
================================================================================

A) discover-candidates-clean
POST body:
{ "provider": "openai" }

Optional safe mode (no Firestore writes):
{ "provider": "openai", "dryRun": true }

Note on dryRun:

- Useful to validate prompt/behavior without polluting candidates/history.
- Not required for normal operation if you trust the service.

B) post-random-clean
POST body:
{}

================================================================================ 12) Environment Variables
================================================================================

discover-candidates-clean:

- OPENAI_API_KEY

post-random-clean:

- BOT_TOKEN
- CHANNEL_ID_RU
- CHANNEL_ID_EN
- optional OpenAI keys if generation occurs at posting stage

Cloud Run uses the default service account unless explicitly overridden.

================================================================================ 13) Repo Tools (tools/)
================================================================================

Operational scripts:

- updateCooldown.js — bulk update cooldown fields
- importCandidates.js / importEffects.js — bulk importers
- firestore_ping.mjs — connectivity/debug helper
- reconcile-candidates.js — detect inconsistencies
- import_cards_ready_to_firestore.js — import utility for ready cards

These scripts exist to simplify maintenance at scale.

================================================================================ 14) Architectural Philosophy
================================================================================

This system is intentionally:

- not optimized for speed
- not optimized for volume
- not optimized for virality

It is optimized for:

- autonomy
- stability
- data quality
- long-term unattended operation

If the system runs quietly for weeks and occasionally produces new content, it is behaving exactly as designed.
