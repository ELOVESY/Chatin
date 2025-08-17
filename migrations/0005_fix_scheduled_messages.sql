-- Fix Scheduled Messages
-- Migration: 0005_fix_scheduled_messages.sql

-- Create scheduled_messages table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_username text NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
  receiver_username text NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0),
  scheduled_for timestamp with time zone NOT NULL,
  expires_at timestamp with time zone DEFAULT NULL,
  sent_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS scheduled_messages_sender_scheduled_idx 
ON public.scheduled_messages (sender_username, scheduled_for);

-- Add index for finding messages ready to send
CREATE INDEX IF NOT EXISTS scheduled_messages_ready_idx 
ON public.scheduled_messages (scheduled_for) 
WHERE sent_at IS NULL;

-- Create a function to send scheduled messages
CREATE OR REPLACE FUNCTION process_scheduled_messages()
RETURNS INTEGER AS $$
DECLARE
  message_record RECORD;
  sent_count INTEGER := 0;
BEGIN
  -- Find messages that are ready to send
  FOR message_record IN 
    SELECT * FROM scheduled_messages 
    WHERE scheduled_for <= NOW() AND sent_at IS NULL
    ORDER BY scheduled_for ASC
  LOOP
    -- Insert into messages table
    INSERT INTO messages (
      sender_username, 
      receiver_username, 
      content, 
      expires_at,
      created_at
    ) VALUES (
      message_record.sender_username,
      message_record.receiver_username,
      message_record.content,
      message_record.expires_at,
      NOW()
    );
    
    -- Mark as sent
    UPDATE scheduled_messages 
    SET sent_at = NOW() 
    WHERE id = message_record.id;
    
    sent_count := sent_count + 1;
  END LOOP;
  
  RETURN sent_count;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION process_scheduled_messages() TO service_role;
