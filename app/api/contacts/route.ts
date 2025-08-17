import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const Body = z.object({
  owner: z.string().min(1).max(32),
  contact: z.string().min(1).max(32)
});

// GET: Retrieve contacts for a user
export async function GET(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('contact_username')
      .eq('owner_username', username)
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ contacts: data?.map(c => c.contact_username) ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}

// POST: Add a new contact
export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const json = await req.json();
    const { owner, contact } = Body.parse(json);
    
    if (owner === contact) {
      return NextResponse.json({ error: 'Cannot add yourself as a contact' }, { status: 400 });
    }
    
    // Check if contact user exists
    const { data: user, error: ue } = await supabaseAdmin
      .from('users')
      .select('username')
      .eq('username', contact)
      .single();
      
    if (ue || !user) {
      return NextResponse.json({ error: 'Contact username not found' }, { status: 404 });
    }

    // Check if contact already exists
    const { data: existing, error: ee } = await supabaseAdmin
      .from('contacts')
      .select('id')
      .eq('owner_username', owner)
      .eq('contact_username', contact)
      .single();
      
    if (existing) {
      return NextResponse.json({ error: 'Contact already exists' }, { status: 409 });
    }

    // Add the contact
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({ owner_username: owner, contact_username: contact })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}

// DELETE: Remove a contact
export async function DELETE(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');
    const contact = searchParams.get('contact');
    
    if (!owner || !contact) {
      return NextResponse.json({ error: 'Owner and contact required' }, { status: 400 });
    }
    
    const { error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('owner_username', owner)
      .eq('contact_username', contact);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Invalid request' }, { status: 400 });
  }
}
