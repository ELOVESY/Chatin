import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
  sender: z.string().min(1).max(32),
  receiver: z.string().min(1).max(32),
  content: z.string().min(1).max(2000),
  scheduledFor: z.string(), // ISO timestamp
  expiresInMinutes: z.number().optional()
});

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const json = await req.json();
    const { sender, receiver, content, scheduledFor, expiresInMinutes } = Body.parse(json);
    
    const scheduledTime = new Date(scheduledFor);
    if (scheduledTime <= new Date()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future' }, { status: 400 });
    }
    
    if (sender === receiver) {
      return NextResponse.json({ error: 'Cannot message yourself.' }, { status: 400 });
    }
    
    // Calculate expires_at timestamp if expiration is set
    let expires_at = null;
    if (expiresInMinutes && expiresInMinutes > 0) {
      expires_at = new Date(scheduledTime.getTime() + expiresInMinutes * 60 * 1000).toISOString();
    }
    
    // Ensure both users exist
    await supabaseAdmin.from('users').upsert([{ username: sender }, { username: receiver }], { onConflict: 'username' });
    
    // Store in scheduled_messages table (we need to create this)
    const messageData: any = { 
      sender_username: sender, 
      receiver_username: receiver, 
      content,
      scheduled_for: scheduledFor
    };
    
    if (expires_at) {
      messageData.expires_at = expires_at;
    }
    
    const { data, error } = await supabaseAdmin
      .from('scheduled_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ scheduled_message: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}

// GET endpoint to retrieve scheduled messages for a user
export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('scheduled_messages')
      .select('*')
      .eq('sender_username', username)
      .order('scheduled_for', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ scheduled_messages: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
