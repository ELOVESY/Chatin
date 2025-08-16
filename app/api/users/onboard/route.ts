import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({ username: z.string().min(3).max(32) });

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const { username } = Body.parse(await req.json());
  const { error } = await supabaseAdmin.from('users').insert({ username }).select().single();
  if (error) return NextResponse.json({ error: 'Username taken or invalid' }, { status: 400 });
  return NextResponse.json({ ok: true });
}


