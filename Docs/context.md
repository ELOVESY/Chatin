## Project Context: Calculator-Decoy Chat (Next.js 14, Vercel, Supabase)

### Summary (as requested)
Build a Next.js 14 + TailwindCSS app that I can deploy on Vercel.  
The app should look like a calculator at first (decoy), and only reveal a hidden chat feature when a secret code is typed.  
It should support multiple users (with usernames) so two devices can chat with each other in real time.

Requirements:

1. **Calculator (default view)**  
   - Standard calculator layout (digits 0–9, +, -, ×, ÷, =, Clear).  
   - Keep track of the last 6 digits entered.  
   - If they match "314159", switch to Chat view.  
   - Must look like a normal calculator otherwise.  

2. **Onboarding**  
   - When chat is unlocked the first time, ask the user to set a **username** (stored in localStorage).  
   - On subsequent opens, skip onboarding and use the saved username.  

3. **Chat UI**  
   - List of contacts on the left.  
   - Main chat window with messages (bubbles).  
   - Text input at the bottom.  
   - Option to **Add Contact**: type another person’s username.  

4. **Message relay (backend)**  
   - Use a simple API route or WebSocket server inside Next.js.  
   - When a user adds a contact, messages typed should be sent to the backend, which relays them to the contact’s chat window in real time.  
   - Store messages in memory for now (not persistent across redeploys).  
   - Messages should appear in real time on both devices.  

5. **Styling**  
   - Calculator looks realistic and minimal.  
   - Chat looks like a simple messenger (two panes: contacts + messages).  

6. **Hosting**  
   - Must run entirely on Vercel.  
   - Use Next.js API routes for backend message relay.  
   - Deployable immediately.  

For now:  
- Only text messages (no files, no encryption).  
- No login/passwords, just usernames.  
- No persistence after server restart (in-memory store is fine for beta testing).  

---

## Contextual Spec (enhanced, with Supabase persistence + realtime)

### Purpose
- A decoy calculator that unlocks a real-time messenger via secret code "314159".
- No formal auth; just a unique username stored in `localStorage`.
- Add Supabase for message storage and realtime delivery while still relaying sends through a Next.js API route (fits Vercel).

### High-level Architecture
- Framework: Next.js 14 (App Router) + TailwindCSS.
- Hosting: Vercel (Node runtime for API routes).
- State:
  - Username: persisted in `localStorage`.
  - Contacts: persisted in Supabase (and optionally cached in `localStorage` for quick load).
  - Messages: stored in Supabase, real-time updates via Supabase Realtime.
- Backend:
  - API route `POST /api/messages` receives a message, validates it, writes to Supabase.
  - Optional routes: `POST /api/users/onboard` to claim username, `POST /api/contacts/add` to add contacts.
- Realtime Delivery:
  - Clients subscribe to Supabase Realtime (`postgres_changes` on `messages` table) filtered by `receiver_username` and `sender_username`.
  - On insert, both sender and receiver update their UIs in real-time.
- Decoy:
  - Calculator UI captures recent input (last 6 digits). On "314159", reveal chat.

### UI/UX Requirements
- Calculator
  - Numeric keypad, +, -, ×, ÷, =, Clear.
  - Looks/behaves like a normal calculator.
  - Tracks last 6 digits typed; if equals "314159" -> switch to Chat.
- Onboarding
  - First unlock: prompt for username (unique). Save to `localStorage` (`chat.username`).
  - If username exists, skip prompt.
- Chat
  - Left pane: contacts (usernames); button to "Add Contact".
  - Right pane: message thread with bubbles; input at bottom.
  - Threads are by pair `(me, contact)`.

### Data Model (Supabase)
Use SQL below in Supabase SQL editor. For MVP, you may disable RLS on these tables to avoid auth complexity. For production, add proper RLS and lightweight auth.

```sql
-- Users table
create table if not exists public.users (
  username text primary key,
  created_at timestamp with time zone default now()
);

-- Contacts: adjacency list of who you’ve added
create table if not exists public.contacts (
  owner_username text references public.users(username) on delete cascade,
  contact_username text references public.users(username) on delete cascade,
  created_at timestamp with time zone default now(),
  primary key (owner_username, contact_username)
);

-- Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_username text not null references public.users(username) on delete cascade,
  receiver_username text not null references public.users(username) on delete cascade,
  content text not null check (char_length(content) > 0),
  created_at timestamp with time zone default now()
);

-- Helpful indexes for realtime and queries
create index if not exists messages_receiver_created_at_idx on public.messages (receiver_username, created_at desc);
create index if not exists messages_pair_created_at_idx on public.messages (sender_username, receiver_username, created_at desc);
```

Enable Realtime:
- In Supabase UI: Database → Replication → Configure → Turn ON Realtime for `public.messages`.

RLS (MVP suggestion):
- For simplicity, disable RLS on `users`, `contacts`, and `messages` during MVP.
- If you keep RLS enabled, use the API (service role key) for writes and reads; frontend should only subscribe to Realtime. Add permissive policies or a thin auth later.

### Environment Variables (Vercel Project Settings)
- `NEXT_PUBLIC_SUPABASE_URL` = your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key (frontend)
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (server-only; never expose to client)

Optional:
- `NEXT_PUBLIC_APP_NAME` = "Calc Messenger"

### Dependencies
```bash
npm i @supabase/supabase-js zod clsx
npm i -D tailwindcss postcss autoprefixer
```

### Project Structure (suggested)
- `app/` App Router pages
- `app/(ui)/calculator/` calculator decoy
- `app/(ui)/chat/` chat UI (client component)
- `app/api/messages/route.ts` message relay (server)
- `app/api/users/onboard/route.ts` username claim
- `app/api/contacts/add/route.ts` add contact
- `lib/supabaseClient.ts` browser client (anon)
- `lib/supabaseAdmin.ts` server client (service role)

### Core Code Snippets

Supabase clients:
```ts
// lib/supabaseClient.ts (client)
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
	{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
);
```

```ts
// lib/supabaseAdmin.ts (server)
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
	{ auth: { persistSession: false } }
);
```

API route to send messages:
```ts
// app/api/messages/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
	sender: z.string().min(1).max(32),
	receiver: z.string().min(1).max(32),
	content: z.string().min(1).max(2000)
});

export async function POST(req: Request) {
	try {
		const json = await req.json();
		const { sender, receiver, content } = Body.parse(json);
		if (sender === receiver) {
			return NextResponse.json({ error: 'Cannot message yourself.' }, { status: 400 });
		}
		await supabaseAdmin.from('users').upsert([{ username: sender }, { username: receiver }], { onConflict: 'username' });
		const { data, error } = await supabaseAdmin
			.from('messages')
			.insert({ sender_username: sender, receiver_username: receiver, content })
			.select()
			.single();

		if (error) return NextResponse.json({ error: error.message }, { status: 400 });
		return NextResponse.json({ message: data }, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
	}
}
```

Realtime subscription:
```ts
// Subscribe to messages for the active thread (client)
import { supabase } from '@/lib/supabaseClient';

export function subscribeToThread(me: string, contact: string, onMessage: (msg: any) => void) {
	const channel = supabase
		.channel(`messages:${me}:${contact}`)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'messages',
				filter: `receiver_username=eq.${me}`
			},
			(payload) => {
				const row = payload.new as any;
				if (row.sender_username === contact) onMessage(row);
			}
		)
		.subscribe();

	return () => supabase.removeChannel(channel);
}
```

Calculator decoy (unlock on 314159):
```tsx
// components/Calculator.tsx (client)
'use client';
import { useState } from 'react';

export default function Calculator({ onUnlock }: { onUnlock: () => void }) {
	const [display, setDisplay] = useState('0');
	const [last6, setLast6] = useState<string>('');

	function pushDigit(d: string) {
		const next = (display === '0' ? d : display + d).slice(0, 18);
		setDisplay(next);
		const tail = (last6 + d).slice(-6);
		setLast6(tail);
		if (tail === '314159') onUnlock();
	}

	return (
		<div className="w-full max-w-xs p-4 bg-gray-900 rounded-lg shadow">
			<div className="text-right text-white text-2xl mb-3 h-10">{display}</div>
			<div className="grid grid-cols-4 gap-2">
				{['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','=','+'].map(k => (
					<button key={k} className="py-3 rounded bg-gray-700 text-white" onClick={() => pushDigit(/\d|\./.test(k) ? k : '')}>
						{k}
					</button>
				))}
				<button className="col-span-4 py-3 rounded bg-red-600 text-white" onClick={() => { setDisplay('0'); setLast6(''); }}>
					Clear
				</button>
			</div>
		</div>
	);
}
```

Onboarding (localStorage username):
```ts
// utils/username.ts (client)
export function getUsername(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem('chat.username');
}
export function setUsername(u: string) {
	localStorage.setItem('chat.username', u);
}
```

### Message Flow
- User types in chat, submits message.
- Frontend POSTs to `/api/messages` with `{ sender, receiver, content }`.
- API validates and inserts into `public.messages` via service role key (and upserts users).
- Supabase Realtime emits an INSERT event to subscribed clients (receiver device, and optionally sender for confirmation).
- UI updates in real-time; optimistic UI renders immediately on sender.

### Contacts and Username Claim (optional APIs)
```ts
// app/api/users/onboard/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({ username: z.string().min(3).max(32) });

export async function POST(req: Request) {
	const { username } = Body.parse(await req.json());
	const { error } = await supabaseAdmin.from('users').insert({ username }).select().single();
	if (error) return NextResponse.json({ error: 'Username taken or invalid' }, { status: 400 });
	return NextResponse.json({ ok: true });
}
```

```ts
// app/api/contacts/add/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({ owner: z.string(), contact: z.string() });

export async function POST(req: Request) {
	const { owner, contact } = Body.parse(await req.json());
	const { data: user, error: ue } = await supabaseAdmin.from('users').select('username').eq('username', contact).single();
	if (ue || !user) return NextResponse.json({ error: 'Contact username not found' }, { status: 404 });

	const { error } = await supabaseAdmin.from('contacts').insert({ owner_username: owner, contact_username: contact });
	if (error) return NextResponse.json({ error: error.message }, { status: 400 });

	return NextResponse.json({ ok: true });
}
```

### Styling
- Tailwind for rapid UI. Calculator minimal/realistic.
- Chat layout: `grid grid-cols-[240px_1fr] h-screen` for two-pane layout.

### Deployment (Vercel)
1. Create Supabase project; copy URL + keys.
2. Run the SQL schema in `migrations/0001_init.sql`; enable Realtime for `messages`.
3. In Vercel:
   - Add env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Deploy.
5. Verify: open on two devices, set usernames, add contact, send message—observe realtime updates.

### Local Development
```bash
npm install
npm run dev
```
- Copy env vars into `.env.local`.
- Test messaging with two browser windows.

### Verification Checklist
- Calculator unlocks only on "314159".
- Username onboarding writes to `localStorage` and users table (via message send or onboarding).
- Adding contact writes to `contacts`.
- Sending message creates a row and triggers realtime to the receiver.
- Refresh shows history loaded from Supabase.

### Limitations (MVP)
- No auth; usernames can be squatted.
- No E2E encryption; plaintext in DB.
- RLS disabled/permissive; harden before production.
- No typing indicators/read receipts.

### Future Enhancements
- Add Supabase Auth and RLS policies.
- Conversation IDs and pagination.
- Attachments and message statuses.
- Presence and typing indicators.

### Documentation & Logging
- Update `Docs/app_state.md` for changes.
- Log bugs in `Docs/error_log.md` and solutions in `Docs/solutions.md`.
- Record successful verifications in `Docs/success_log.md` with dates and steps.
