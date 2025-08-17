-- Enhanced Features Migration
-- Migration: 0004_enhanced_features.sql

-- Add password_hash column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS password_hash text DEFAULT NULL;

-- Add file-related columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS file_url text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS file_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS file_size integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS file_type text DEFAULT NULL;

-- Create storage bucket for chat files
-- Note: This needs to be run in Supabase Storage section
-- INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true);

-- Add indexes for file queries
CREATE INDEX IF NOT EXISTS messages_file_url_idx ON public.messages (file_url) WHERE file_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS messages_file_type_idx ON public.messages (file_type) WHERE file_type IS NOT NULL;

-- Add RLS policies for better security (optional)
-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own data
CREATE POLICY "Users can read their own data" ON public.users
  FOR SELECT USING (auth.uid()::text = username OR auth.role() = 'service_role');

-- Create policy for users to update their own data
CREATE POLICY "Users can update their own data" ON public.users
  FOR UPDATE USING (auth.uid()::text = username OR auth.role() = 'service_role');

-- Create policy for service role to manage all users
CREATE POLICY "Service role can manage all users" ON public.users
  FOR ALL USING (auth.role() = 'service_role');

-- Enable RLS on contacts table
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Create policy for contacts
CREATE POLICY "Users can manage their own contacts" ON public.contacts
  FOR ALL USING (auth.uid()::text = owner_username OR auth.role() = 'service_role');

-- Enable RLS on messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policy for messages
CREATE POLICY "Users can manage their own messages" ON public.messages
  FOR ALL USING (
    auth.uid()::text = sender_username OR 
    auth.uid()::text = receiver_username OR 
    auth.role() = 'service_role'
  );
