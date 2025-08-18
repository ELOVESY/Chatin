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

Recent Updates:
- Removed "Show History" button from UI (only unlocked by typing "msgmsg")
- Fixed UI layout issues with responsive design improvements
- Added proper flex-shrink-0 to prevent message input from being cut off
- Improved mobile responsiveness for all screen sizes
- **NEW**: Complete mobile-first responsive redesign
- **NEW**: Chat bar now properly positioned at bottom on all screen sizes
- **NEW**: Added custom xs breakpoint (475px) for better small screen handling
- **NEW**: Compact button and input sizing for mobile devices
- **NEW**: WhatsApp-like layout with chat input always visible at bottom

Verification checklist:
- Unlock with 314159.
- Set username when first unlocked.
- Add contact → send message → appears realtime on other device.
- Type "msgmsg" to unlock message history (button no longer visible in UI)
- **NEW**: Chat interface should work smoothly on all screen sizes without horizontal scrolling
- **NEW**: Message input should always be visible at bottom on mobile devices

Limitations:
- No auth/RLS for MVP. Not production hardened.
