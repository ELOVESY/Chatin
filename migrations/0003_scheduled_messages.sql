-- Add scheduled messages feature
-- Migration: 0003_scheduled_messages.sql

-- Create scheduled_messages table
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_username text NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
  receiver_username text NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  scheduled_for timestamp with time zone NOT NULL,
  expires_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now(),
  sent_at timestamp with time zone DEFAULT NULL
);

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS scheduled_messages_sender_scheduled_idx 
ON public.scheduled_messages (sender_username, scheduled_for);

CREATE INDEX IF NOT EXISTS scheduled_messages_scheduled_for_idx 
ON public.scheduled_messages (scheduled_for) 
WHERE sent_at IS NULL;

-- Function to process scheduled messages (move to messages table when time arrives)
CREATE OR REPLACE FUNCTION process_scheduled_messages()
RETURNS INTEGER AS $$
DECLARE
  scheduled_msg RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Get all unsent scheduled messages that should be sent now
  FOR scheduled_msg IN 
    SELECT * FROM public.scheduled_messages 
    WHERE scheduled_for <= NOW() 
      AND sent_at IS NULL
  LOOP
    -- Insert into messages table
    INSERT INTO public.messages (sender_username, receiver_username, content, expires_at)
    VALUES (
      scheduled_msg.sender_username, 
      scheduled_msg.receiver_username, 
      scheduled_msg.content,
      scheduled_msg.expires_at
    );
    
    -- Mark as sent
    UPDATE public.scheduled_messages 
    SET sent_at = NOW() 
    WHERE id = scheduled_msg.id;
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN processed_count;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION process_scheduled_messages() TO service_role;
GRANT ALL ON TABLE public.scheduled_messages TO service_role;

-- Optional: Function to clean up old sent scheduled messages (older than 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_scheduled_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.scheduled_messages 
  WHERE sent_at IS NOT NULL 
    AND sent_at < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION cleanup_old_scheduled_messages() TO service_role;
