# 🌿 EthnoPharma Cloud — AI-Powered Ethnobotany Pipeline (GCP, Cloud Run, Firestore)

EthnoPharma Cloud is a fully automated AI-driven system for discovering, enriching and publishing ethnobotanical plant knowledge.  
It runs 100% serverlessly on **Google Cloud Run**, uses **Firestore** as the main data store, and applies **OpenAI models** to generate structured bilingual content.

This repository contains the production-grade, cleaned version of the system — designed for recruiters, engineers and collaborators.

---

## 🧩 Features

- **Autonomous plant discovery** (AI-based)
- **Full enrichment pipeline** (sources → narrative → effects → image)
- **Multilingual text generation (RU/EN)**
- **Automatic posting to Telegram (via bot API)**
- **ETL-style modular pipelines**
- **Serverless execution via Cloud Run Jobs & Services**
- **Firestore-based content state machine**
- **Robust normalization, validation, safety rules**
- **Image attribution via iNaturalist**
- **Affiliate link auto-detection (iHerb etc.)**
- **Clean, explicit, maintainable architecture**

---

# 📐 Architecture Overview

```
ethnopharma-cloud/
│
├── src_clean/
│   ├── services/
│   │   ├── discover-candidates-clean/    # Cloud Run Job — AI-based discovery of new plants
│   │   └── post-random-clean/            # Cloud Run Service — daily posting to Telegram
│   │
│   ├── pipeline/                         # Full enrichment pipeline (local or Cloud Run)
│   │   ├── steps/                        # 01–10 modular steps (find, fetch, enrich, pick image…)
│   │   ├── services/                     # iNaturalist, affiliate search, image processing
│   │   ├── utils/                        # normalization, validation, networking, metadata
│   │   ├── config/                       # allowlists, vocabularies, schemas
│   │   └── tools/                        # audit reports, HTML cleaning, file-safe operations
│
├── tools/                                # Repo-wide operational scripts
│   ├── importCandidates.js
│   ├── importEffects.js
│   ├── import_cards_ready_to_firestore.js
│   ├── updateCooldown.js
│   ├── reconcile-candidates.js
│   └── firestore_ping.mjs
│
└── Dockerfile                            # Cloud Run compatible image for services
```

---

# 🚀 Deployment (Google Cloud Run)

### **1. Build container**

```sh
gcloud builds submit --tag gcr.io/$PROJECT_ID/post-random-clean
```

### **2. Deploy service (Telegram posting)**

```sh
gcloud run deploy post-random-clean \
  --image gcr.io/$PROJECT_ID/post-random-clean \
  --platform=managed \
  --region=me-west1 \
  --allow-unauthenticated
```

### **3. Deploy job (discover-candidates)**

```sh
gcloud run jobs deploy discover-candidates-clean \
  --image gcr.io/$PROJECT_ID/discover-candidates-clean \
  --region=me-west1
```

### **4. Cloud Scheduler example (daily 9:00)**

```sh
gcloud scheduler jobs create http telegram-daily \
  --schedule="0 9 * * *" \
  --uri="https://post-random-clean-xxxxx.run.app" \
  --http-method=POST
```

---

# 🛠 Local Development

### Install

```sh
npm install
```

### Run posting service locally

```sh
npm run dev:post
```

### Run candidate discovery locally

```sh
npm run dev:discover
```

### Required environment variables

- `GOOGLE_APPLICATION_CREDENTIALS`
- `BOT_TOKEN`
- `CHANNEL_ID`
- OpenAI API keys (pipeline / discovery)

---

# 🧪 Pipeline Breakdown (7 Steps)

Located in: **src_clean/pipeline/steps/**

1. **01_findCandidates** — initial candidate detection
2. **02_fetchSources** — scrape scientific & ethnobotanical sources
3. **03_enrichNarrative** — generate bilingual narrative
4. **04_extractEffects** — effect extraction (adaptogens, anxiolytics etc.)
5. **05_pickImage** — iNaturalist image + attribution
6. **06_affiliate** — detect/store affiliate links
7. **08_qualityGate** — rule-based safety & quality checks

---

# 🔧 Operational Tools

Directory: `tools/`

- `updateCooldown.js` — bulk update Firestore field `cooldownDays`
- `importCandidates.js` / `importEffects.js` — bulk importers
- `firestore_ping.mjs` — connection debugging
- `reconcile-candidates.js` — detect inconsistencies

These scripts simplify maintenance of large content volumes.

---

# 📦 Technologies Used

- Node.js 22
- Google Cloud Run (Jobs + Services)
- Firestore (Native mode)
- Google Cloud Scheduler
- Docker (Cloud Build)
- OpenAI APIs
- iNaturalist API
- Telegram Bot API
- Modular ETL patterns
- Bilingual content handling (RU/EN)

---

# 📌 Why This Project Matters (Professional Context)

This repository demonstrates practical experience with:

- serverless cloud architecture,
- asynchronous job orchestration,
- modular ETL-style pipelines,
- Firestore data modeling,
- AI-assisted content generation,
- production-grade deployment with Cloud Run,
- robust multilingual text processing,
- high-volume automated content publishing,
- clean and maintainable codebase.

Designed for scalability and long-term maintainability.

---

# 📄 License

MIT
