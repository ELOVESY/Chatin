-- Add self-destructing messages feature
-- Migration: 0002_self_destruct.sql

-- Add expires_at column to messages table
ALTER TABLE public.messages 
ADD COLUMN expires_at timestamp with time zone DEFAULT NULL;

-- Add index for efficient cleanup of expired messages
CREATE INDEX IF NOT EXISTS messages_expires_at_idx 
ON public.messages (expires_at) 
WHERE expires_at IS NOT NULL;

-- Optional: Add a function to clean up expired messages
-- (Can be called manually or via a scheduled job)
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.messages 
  WHERE expires_at IS NOT NULL 
    AND expires_at <= NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_messages() TO service_role;
