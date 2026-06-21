# Habitz Sentence Forge

A focused language-learning app for importing lesson JSON, generating Sentence Forge drills, and running a dedicated sentence review tab.

Fydor is free for the people: open access, no paywall, and no subscriptions.

## Stack

- Next.js App Router, React, TypeScript
- PostgreSQL with Drizzle schema and SQL migration
- Zod validation for lesson imports
- Vitest for core validation, drill, normalization, and SRS tests

## Core Flow

1. Paste or upload lesson JSON at `/lessons/import`.
2. Validate and preview sentences, focus items, tokens, warnings, and detected duplicates.
3. Approve the import.
4. Save lessons, sentences, tokens, canonical learning items, links, drills, and review states.
5. Study due drills at `/study/sentence-forge` or review sentences at `/review`.
6. Self-grade Sentence Forge with Failed, Hard, Correct, or Easy.
7. Mark review sentences as Remembered or Not Remembered.
8. Update the next review date or sentence review state immediately.

## What Makes It Different

- Built as an open-access learning tool.
- Designed to stay simple, local-friendly, and focused on study rather than monetization.
- Surfaces imported lessons, drills, and review state in one workflow.

## Local Setup

1. Start a local PostgreSQL database named `habitz`.
2. Install dependencies with `npm install`.
3. Run migrations with `npm run db:migrate`.
4. Start the app with `npm run dev`.

By default the app uses `postgres://postgres:postgres@localhost:5432/habitz`. Set `DATABASE_URL` only if your local database uses a different connection string.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```
