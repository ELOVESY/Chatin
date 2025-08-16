import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
  sender: z.string().min(1).max(32),
  receiver: z.string().min(1).max(32),
  content: z.string().min(1).max(2000)
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const json = await req.json();
    const { sender, receiver, content } = Body.parse(json);
    if (sender === receiver) {
      return NextResponse.json({ error: 'Cannot message yourself.' }, { status: 400 });
    }
    // Ensure both users exist (idempotent upsert semantics)
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


