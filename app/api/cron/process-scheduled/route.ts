import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    
    // Process scheduled messages
    const { data, error } = await supabaseAdmin.rpc('process_scheduled_messages');
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      success: true, 
      messages_sent: data || 0 
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Processing failed' }, { status: 400 });
  }
}
