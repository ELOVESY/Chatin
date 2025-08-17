import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Delete all data to start fresh
    await supabaseAdmin.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabaseAdmin.from('contacts').delete().neq('owner_username', 'dummy');
    await supabaseAdmin.from('users').delete().neq('username', 'dummy');
    await supabaseAdmin.from('scheduled_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    return NextResponse.json({ success: true, message: 'All data cleared successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Reset failed' }, { status: 400 });
  }
}
