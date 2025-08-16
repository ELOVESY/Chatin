# App State - Chatin

Date: 2025-08-16

- Implemented Next.js 14 app with calculator decoy unlock -> chat UI.
- Added Supabase integration (client + server admin).
- API: POST `/api/messages` to send messages; upserts users automatically.
- Realtime via Supabase subscriptions on `public.messages`.
- LocalStorage for username and contacts list.
- TailwindCSS styling and layout.
- Migration added at `migrations/0001_init.sql` (enables `pgcrypto`).
- Env vars required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

Architecture:
- App Router pages in `app/`.
- Components: `Calculator`, `Chat`.
- Data: `users`, `contacts`, `messages` tables in Supabase.

Verification checklist:
- Unlock with 314159.
- Set username when first unlocked.
- Add contact → send message → appears realtime on other device.

Limitations:
- No auth/RLS for MVP. Not production hardened.
