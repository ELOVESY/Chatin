import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const Body = z.object({ owner: z.string(), contact: z.string() });

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const { owner, contact } = Body.parse(await req.json());
  const { data: user, error: ue } = await supabaseAdmin
    .from('users')
    .select('username')
    .eq('username', contact)
    .single();
  if (ue || !user) return NextResponse.json({ error: 'Contact username not found' }, { status: 404 });

  const { error } = await supabaseAdmin
    .from('contacts')
    .insert({ owner_username: owner, contact_username: contact });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}


