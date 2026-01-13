# 🌿 EthnoPharma Cloud — AI-Powered Ethnobotany Pipeline

EthnoPharma Cloud is a serverless, production-grade system for discovering, enriching, and publishing ethnobotanical plant cards to Telegram.

It runs on Google Cloud (Cloud Run + Firestore) and uses OpenAI models to generate structured bilingual content (RU / EN). Images are sourced and attributed via iNaturalist.

This repository contains a cleaned, stable version of the project intended for professional review.

## What the system does

- AI-assisted discovery of ethnobotanical plant candidates
- Modular enrichment pipeline (sources → narrative → effects → image → affiliate)
- RU / EN bilingual content generation
- Automated Telegram publishing via Bot API
- Firestore-driven content lifecycle (status, posting history, cooldowns)
- Safety and quality gates with strict normalization rules

## High-level architecture

- Firestore is the single source of truth

  - `candidates` — newly discovered plants awaiting enrichment
  - `cards` — fully enriched, publishable plant cards

- Cloud Run services

  - `discover-candidates-clean` — AI-based candidate discovery (Scheduler-triggered HTTP)
  - `post-random-clean` — publishes ready cards to Telegram

- Enrichment pipeline
  - A modular ETL-style flow that transforms candidates into publishable cards

## Technology stack

- Node.js
- Google Cloud Run (Services)
- Firestore (Native mode)
- Google Cloud Scheduler
- OpenAI API
- iNaturalist (image sourcing and attribution)
- Telegram Bot API

## Professional context

This project demonstrates practical experience with:

- serverless cloud architecture
- asynchronous orchestration
- modular ETL-style pipelines
- Firestore data modeling
- AI-assisted content generation
- multilingual text processing
- production-grade automation and deployment

Designed for long-term stability and maintainability.

## License

MIT
