# 🌿 EthnoPharma Cloud

EthnoPharma Cloud is a serverless system for automated discovery, enrichment, validation, and publication of ethnobotanical plant data.

The system operates fully autonomously on Google Cloud as a set of independent scheduled Cloud Run services. Its output is structured, bilingual (RU / EN) plant cards that are published automatically to Telegram channels via a bot.

This repository contains a cleaned and stable version of the project intended for public and professional review.

## What the system does

EthnoPharma Cloud automates a complete ethnobotanical content workflow:

- discovers ethnobotanically relevant plant candidates using an LLM (currently GPT-4o mini),
- collects information from credible scientific, ethnobotanical, and reference sources,
- enriches and structures the collected data using an LLM,
- applies normalization, validation, and safety rules,
- attaches attributed plant imagery (sourced from iNaturalist),
- attaches partner / affiliate links (e.g. iHerb) when relevant,
- publishes validated plant cards to Telegram channels on a schedule.

All stages are automated and state-driven. The system is not interactive and does not operate in real time.

## Processing model

Conceptual lifecycle:

discover → enrich → validate → publish (Telegram)

Key characteristics:

- discovery, enrichment, and publishing are decoupled stages,
- each stage runs independently on its own schedule,
- runs that produce no new candidates or no publishable cards are expected and normal,
- processing and publishing state is persisted to ensure controlled retries and predictable behavior.

## Use of LLMs

Large Language Models (currently GPT-4o mini) are used as part of the pipeline for:

- candidate discovery,
- structured data enrichment,
- bilingual (RU / EN) content generation.

LLM output is based on collected source material and constrained by validation and safety rules.

## Data and publishing

- Firestore is used as the primary datastore for plant data, processing state, and publishing metadata.
- Only fully validated plant cards are eligible for publishing.
- Publishing is handled by a dedicated scheduled process that selects eligible cards, enforces cooldown and posting history rules, and posts to Telegram channels via a bot.

Discovery, enrichment, and publishing are intentionally separated responsibilities.

## Output

Each published plant card includes:

- bilingual textual description (RU / EN),
- documented ethnobotanical uses and reported effects based on scientific and reference sources,
- attributed plant imagery,
- partner or affiliate links when available,
- publishing metadata (history, cooldowns).

## Architecture (high level)

- serverless execution on Google Cloud,
- autonomous scheduled Cloud Run services,
- Firestore as the primary datastore,
- OpenAI API for LLM-based processing,
- automated publishing to Telegram channels via a bot,
- external sources for reference data and imagery.

## Technology stack

- Node.js
- Google Cloud Run
- Google Cloud Scheduler
- Firestore
- OpenAI (GPT-4o mini)
- Telegram (channels + bot)

## Scope and intent

This repository documents a working production system focused on:

- automated data pipelines,
- scheduled serverless execution,
- controlled use of LLMs,
- long-term autonomous operation,
- separation of data processing and distribution.

It is not a chatbot and not a real-time service.

## Live output

The system publishes its output to Telegram channels:

- English: https://t.me/ethnopharma_ethnobotany
- Russian: https://t.me/ethnopharma

## Possible extensions

Although the current implementation focuses on ethnobotanical data, the underlying approach is domain-agnostic.

The same pipeline structure can be adapted to other knowledge domains that require:

- source-grounded data collection,
- LLM-assisted structuring and enrichment,
- validation and controlled publishing workflows.

This project intentionally keeps the core processing logic decoupled from domain-specific content.

This section describes architectural potential, not a committed roadmap.

## License

MIT
