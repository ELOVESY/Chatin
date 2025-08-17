import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
  sender: z.string().min(1).max(32),
  receiver: z.string().min(1).max(32),
  content: z.string().min(1).max(2000),
  expiresInMinutes: z.number().optional() // Optional: minutes until message expires
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const json = await req.json();
    const { sender, receiver, content, expiresInMinutes } = Body.parse(json);
    if (sender === receiver) {
      return NextResponse.json({ error: 'Cannot message yourself.' }, { status: 400 });
    }
    
    // Calculate expires_at timestamp if expiration is set
    let expires_at = null;
    if (expiresInMinutes && expiresInMinutes > 0) {
      expires_at = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();
    }
    
    // Ensure both users exist (idempotent upsert semantics)
    await supabaseAdmin.from('users').upsert([{ username: sender }, { username: receiver }], { onConflict: 'username' });
    
    // Auto-add contacts for both users if they don't exist
    await supabaseAdmin.from('contacts').upsert([
      { owner_username: sender, contact_username: receiver },
      { owner_username: receiver, contact_username: sender }
    ], { onConflict: 'owner_username,contact_username' });
    
    const messageData: any = { 
      sender_username: sender, 
      receiver_username: receiver, 
      content 
    };
    
    if (expires_at) {
      messageData.expires_at = expires_at;
    }
    
    const { data, error } = await supabaseAdmin
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ message: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}


