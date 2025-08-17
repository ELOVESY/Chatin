import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sender = formData.get('sender') as string;
    const receiver = formData.get('receiver') as string;
    
    if (!file || !sender || !receiver) {
      return NextResponse.json({ error: 'File, sender, and receiver required' }, { status: 400 });
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 });
    }
    
    // Validate file type
    const allowedTypes = ['image/', 'video/', 'audio/', 'text/', 'application/pdf', 'application/zip'];
    const isValidType = allowedTypes.some(type => file.type.startsWith(type));
    if (!isValidType) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop();
    const fileName = `${sender}_${receiver}_${timestamp}.${fileExtension}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('chat-files')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 });
    }
    
    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('chat-files')
      .getPublicUrl(fileName);
    
    // Store file info in database
    const { data: messageData, error: messageError } = await supabaseAdmin
      .from('messages')
      .insert({
        sender_username: sender,
        receiver_username: receiver,
        content: `📎 ${file.name}`,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_type: file.type
      })
      .select()
      .single();
    
    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 400 });
    }
    
    return NextResponse.json({ 
      message: messageData,
      file_url: urlData.publicUrl 
    }, { status: 201 });
    
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Upload failed' }, { status: 400 });
  }
}
