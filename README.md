# EthnoPharma — Auto Card Posting (Starter)

Minimal pipeline: CSV -> image card -> Telegram post.

## Quick start
1) Install Node.js 18+
2) `npm i`
3) Copy `.env.example` to `.env`, fill BOT_TOKEN and CHANNEL_ID
4) Put your cards into `data/cards.csv` (see headers)
5) Test a single post:
   ```bash
   npm run post-once
   ```
6) Run bot with scheduler:
   ```bash
   npm start
   ```

## Data schema (CSV headers)
`id, category, title_ru, title_en, latin, summary, ethnobotany, modern_evidence, safety, sources, image_url, status, scheduled_at, posted_at`

- `status`: `draft | ready | posted`
- `sources`: `;`-separated list of links (only first 3 are printed on the card)

## Commands (in Telegram chat with your bot)
- `/post_next` — renders and sends the next READY card to you (for testing)
- `/today` — tells that scheduler is active
Scheduler uses `CRON_SCHEDULE` from `.env` to post into `CHANNEL_ID` automatically.

## Notes
- Rendering uses node-canvas and a simple beige/graphite palette.
- Add your custom fonts to `assets/` as `Inter-Regular.ttf` and/or `PlayfairDisplay-Regular.ttf`.
- Image size: 1280x720 (suitable for Telegram preview).
