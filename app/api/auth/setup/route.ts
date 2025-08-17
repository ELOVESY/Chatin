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
    
    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', username)
      .single();
    
    if (existingUser) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    
    // Create new user with password
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .insert({ 
        username, 
        password_hash: password, // In production, hash this password
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ success: true, username: user.username });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Setup failed' }, { status: 400 });
  }
}
