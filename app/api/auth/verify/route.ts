import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
  username: z.string().min(1).max(32),
  password: z.string().min(4).max(8)
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const json = await req.json();
    const { username, password } = Body.parse(json);
    
    // Check if user exists and verify password
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('username, password_hash')
      .eq('username', username)
      .single();
    
    if (error || !user) {
      return NextResponse.json({ error: 'Username not found' }, { status: 404 });
    }
    
    // For now, use simple password verification (in production, use proper hashing)
    if (user.password_hash !== password) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
    }
    
    return NextResponse.json({ success: true, username: user.username });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Verification failed' }, { status: 400 });
  }
}
