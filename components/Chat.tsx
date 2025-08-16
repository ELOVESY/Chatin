'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Message = {
  id: string;
  sender_username: string;
  receiver_username: string;
  content: string;
  created_at: string;
  expires_at?: string;
};

export default function Chat({ me }: { me: string }) {
  const [contacts, setContacts] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPreviousMessages, setShowPreviousMessages] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selfDestructTimer, setSelfDestructTimer] = useState<number>(0); // 0 = never, value in minutes
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Auto-cleanup expired messages and refresh timers
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => prev.filter(m => !m.expires_at || new Date(m.expires_at) > new Date()));
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const stored = typeof window !== 'undefined' ? localStorage.getItem('chat.contacts') : null;
    if (stored) {
      try {
        const list = JSON.parse(stored) as string[];
        setContacts(list);
        setActive(list[0] ?? null);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const supabase = getSupabaseClient();
    
    // Load existing messages for thread (only if previous messages are unlocked)
    if (showPreviousMessages) {
      supabase
        .from('messages')
        .select('*')
        .or(`and(sender_username.eq.${me},receiver_username.eq.${active}),and(sender_username.eq.${active},receiver_username.eq.${me})`)
        .order('created_at', { ascending: true })
        .then(({ data }) => {
          setMessages((data as Message[]) ?? []);
        });
    } else {
      // Only show messages from this session (new messages)
      setMessages([]);
    }

    // Subscribe realtime for incoming from active (now that Realtime is enabled)
    const channel = supabase
      .channel(`messages:${me}:${active}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_username=eq.${me}` }, (payload) => {
        const row = payload.new as Message;
        if (row.sender_username === active) {
          setMessages((prev) => [...prev, row]);
        }
      })
      .subscribe();

    unsubscribeRef.current = () => supabase.removeChannel(channel);
    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [me, active, showPreviousMessages]);

  function addContact() {
    const u = window.prompt('Add contact by username:');
    if (!u) return;
    if (u === me) return alert('Cannot add yourself');
    if (contacts.includes(u)) return setActive(u);
    const next = [...contacts, u];
    setContacts(next);
    if (typeof window !== 'undefined') localStorage.setItem('chat.contacts', JSON.stringify(next));
    setActive(u);
  }

  async function sendMessage() {
    if (!active || !input.trim()) return;
    const content = input.trim();
    setInput('');
    
    // Check for security trigger (optional - unlocks previous messages)
    if (content === 'msgmsg') {
      setShowPreviousMessages(true);
      // Load previous messages after unlocking
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_username.eq.${me},receiver_username.eq.${active}),and(sender_username.eq.${active},receiver_username.eq.${me})`)
        .order('created_at', { ascending: true });
      setMessages((data as Message[]) ?? []);
      // Don't return here - let the message be sent normally
    }
    
    // Send normal message (always allowed)
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_username: me,
      receiver_username: active,
      content,
      created_at: new Date().toISOString(),
      expires_at: selfDestructTimer > 0 ? new Date(Date.now() + selfDestructTimer * 60 * 1000).toISOString() : undefined
    };
    setMessages((prev) => [...prev, optimistic]);

    const requestBody: any = { sender: me, receiver: active, content };
    if (selfDestructTimer > 0) {
      requestBody.expiresInMinutes = selfDestructTimer;
    }

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    if (!res.ok) {
      alert('Failed to send');
    }
    
    // Close mobile menu after sending
    setIsMobileMenuOpen(false);
  }

  async function scheduleMessage() {
    if (!active || !input.trim() || !scheduledDateTime) return;
    const content = input.trim();
    
    const requestBody: any = { 
      sender: me, 
      receiver: active, 
      content,
      scheduledFor: scheduledDateTime
    };
    
    if (selfDestructTimer > 0) {
      requestBody.expiresInMinutes = selfDestructTimer;
    }

    const res = await fetch('/api/messages/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (res.ok) {
      setInput('');
      setScheduledDateTime('');
      setShowScheduleModal(false);
      alert(`Message scheduled for ${new Date(scheduledDateTime).toLocaleString()}`);
    } else {
      alert('Failed to schedule message');
    }
  }

  async function clearAllMessages() {
    if (!confirm('Delete ALL messages for this conversation? This cannot be undone!')) return;
    
    const supabase = getSupabaseClient();
    await supabase
      .from('messages')
      .delete()
      .or(`and(sender_username.eq.${me},receiver_username.eq.${active}),and(sender_username.eq.${active},receiver_username.eq.${me})`);
    
    setMessages([]);
    setShowPreviousMessages(false);
    alert('Messages deleted successfully!');
  }

  async function clearAllContacts() {
    if (!confirm('Delete ALL contacts? This will clear your contact list!')) return;
    
    setContacts([]);
    setActive(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chat.contacts');
    }
    alert('Contacts cleared successfully!');
  }

  async function resetUsername() {
    if (!confirm('Reset username? You will need to set a new one!')) return;
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chat.username');
    }
    window.location.reload(); // Reload to force new username setup
  }

  async function clearEverything() {
    if (!confirm('⚠️ DELETE EVERYTHING? This will:\n- Delete ALL messages\n- Clear ALL contacts\n- Reset your username\n\nThis CANNOT be undone!')) return;
    
    const supabase = getSupabaseClient();
    
    // Delete all messages where user is sender or receiver
    await supabase
      .from('messages')
      .delete()
      .or(`sender_username.eq.${me},receiver_username.eq.${me}`);
    
    // Clear local data
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chat.contacts');
      localStorage.removeItem('chat.username');
    }
    
    alert('All data deleted! Redirecting to calculator...');
    window.location.reload();
  }

  const displayedMessages = useMemo(() => {
    if (!showPreviousMessages) {
      // Only show messages from current session (after component mounted)
      const sessionStart = new Date().getTime() - 5 * 60 * 1000; // Last 5 minutes as session start
      return messages.filter(m => new Date(m.created_at).getTime() > sessionStart);
    }
    return messages;
  }, [messages, showPreviousMessages]);

  return (
    <div className="h-screen max-h-screen flex flex-col md:grid md:grid-cols-[280px_1fr] overflow-hidden">
      {/* Mobile Header */}
      <header className="md:hidden bg-gray-800 p-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div>
          <div className="text-sm text-gray-400">Signed in as</div>
          <div className="font-semibold">@{me}</div>
          {active && (
            <div className="text-xs text-gray-400">Chat: @{active}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {active && (
            <button
              onClick={clearAllMessages}
              className="p-2 bg-red-600 hover:bg-red-500 text-white rounded"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              🗑️
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded bg-gray-700 hover:bg-gray-600"
            title="Toggle menu"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Contacts Sidebar */}
      <aside className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block bg-gray-800 border-r border-gray-700 p-4 md:relative absolute top-16 left-0 right-0 z-10 max-h-[calc(100vh-4rem)] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-white">Contacts</div>
          <div className="flex gap-2">
            <button className="text-sm text-blue-400 hover:text-blue-300" onClick={addContact}>
              Add
            </button>
            <button 
              className="text-sm text-gray-400 hover:text-white" 
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* Settings Menu */}
        {showSettings && (
          <div className="mb-4 p-3 bg-gray-700 rounded-lg border border-gray-600">
            <div className="text-sm font-semibold text-white mb-3">⚙️ Settings</div>
            <div className="space-y-2">
              <button
                onClick={clearAllMessages}
                disabled={!active}
                className="w-full text-left text-sm text-red-400 hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed p-2 hover:bg-gray-600 rounded"
              >
                🗑️ Clear This Conversation
              </button>
              <button
                onClick={clearAllContacts}
                className="w-full text-left text-sm text-orange-400 hover:text-orange-300 p-2 hover:bg-gray-600 rounded"
              >
                📱 Clear All Contacts
              </button>
              <button
                onClick={resetUsername}
                className="w-full text-left text-sm text-yellow-400 hover:text-yellow-300 p-2 hover:bg-gray-600 rounded"
              >
                👤 Change Username
              </button>
              <button
                onClick={() => {
                  const current = localStorage.getItem('chat.unlockCode') || '0+314519';
                  const newCode = prompt(`Set custom unlock code (current: ${current}):`, current);
                  if (newCode && newCode.trim().length >= 3 && newCode.trim().length <= 20) {
                    localStorage.setItem('chat.unlockCode', newCode.trim());
                    alert(`Unlock code changed to: ${newCode.trim()}`);
                  } else if (newCode !== null) {
                    alert('Unlock code must be 3-20 characters long');
                  }
                }}
                className="w-full text-left text-sm text-purple-400 hover:text-purple-300 p-2 hover:bg-gray-600 rounded"
              >
                🔐 Change Unlock Code
              </button>
              <hr className="border-gray-600 my-2" />
              <button
                onClick={clearEverything}
                className="w-full text-left text-sm text-red-500 hover:text-red-400 p-2 hover:bg-gray-600 rounded font-medium"
              >
                ⚠️ Delete Everything
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {contacts.length === 0 && (
            <div className="text-gray-500 text-sm">No contacts yet</div>
          )}
          {contacts.map((c) => (
            <button
              key={c}
              onClick={() => {
                setActive(c);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
                active === c 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-100'
              }`}
            >
              @{c}
            </button>
          ))}
        </div>
      </aside>

      {/* Chat Section */}
      <section className="flex flex-col h-full flex-1">
        {/* Desktop Header */}
        <header className="hidden md:block p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400">Signed in as</div>
              <div className="font-semibold text-white">@{me}</div>
              {active && (
                <div className="text-sm text-gray-400 mt-1">
                  Chatting with @{active} {!showPreviousMessages && '(Previous messages hidden for privacy)'}
                </div>
              )}
            </div>
            {active && (
              <button
                onClick={clearAllMessages}
                className="px-3 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
                title="Clear this conversation"
              >
                🗑️ Clear Chat
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900">
          {active ? (
            displayedMessages.length > 0 ? (
              <>
                {!showPreviousMessages && (
                  <div className="text-center text-gray-500 text-sm mb-4 p-3 bg-gray-800 rounded-lg">
                    💡 Previous messages hidden for privacy. Send "msgmsg" to view chat history.
                  </div>
                )}
                {displayedMessages.map((m) => {
                  const isExpired = m.expires_at && new Date(m.expires_at) <= new Date();
                  const expiresIn = m.expires_at ? Math.max(0, Math.floor((new Date(m.expires_at).getTime() - Date.now()) / 1000)) : null;
                  
                  if (isExpired) {
                    return (
                      <div key={m.id} className="flex justify-center">
                        <div className="text-xs text-gray-500 italic bg-gray-800 px-3 py-2 rounded-lg">
                          🔥 Message self-destructed
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div key={m.id} className={`flex ${m.sender_username === me ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl ${
                        m.sender_username === me 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-100'
                      } ${expiresIn && expiresIn < 300 ? 'ring-2 ring-orange-400' : ''}`}>
                        <div className="text-xs opacity-70 mb-1 flex items-center justify-between">
                          <span>@{m.sender_username}</span>
                          {expiresIn && (
                            <span className="text-orange-300 text-xs ml-2">
                              ⏱️ {expiresIn < 60 ? `${expiresIn}s` : expiresIn < 3600 ? `${Math.floor(expiresIn/60)}m` : `${Math.floor(expiresIn/3600)}h`}
                            </span>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                      </div>
                    </div>
                  );
                })}
              </>
            ) : (
              <div className="text-gray-500 text-center">
                <div className="mb-2">💬 Start the conversation!</div>
                <div className="text-sm">Type a message below to begin chatting</div>
                {!showPreviousMessages && (
                  <div className="text-xs mt-2 opacity-70">Send "msgmsg" to view previous messages</div>
                )}
              </div>
            )
          ) : (
            <div className="text-gray-500 text-center">
              <div className="mb-2">📱 Select a contact to start chatting</div>
              <div className="text-sm">Add contacts using the "Add" button</div>
            </div>
          )}
        </div>

        {/* Message Input */}
        <footer className="p-4 border-t border-gray-700 bg-gray-800">
          {/* Self-Destruct Timer Selection */}
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-gray-400">⏱️ Self-destruct:</span>
            <select
              value={selfDestructTimer}
              onChange={(e) => setSelfDestructTimer(Number(e.target.value))}
              className="bg-gray-700 text-white border border-gray-600 rounded px-2 py-1 text-xs"
              title="Self-destruct timer"
              aria-label="Select self-destruct timer"
            >
              <option value={0}>Never</option>
              <option value={5}>5 minutes</option>
              <option value={60}>1 hour</option>
              <option value={1440}>24 hours</option>
              <option value={10080}>7 days</option>
            </select>
            {selfDestructTimer > 0 && (
              <span className="text-orange-400 text-xs">
                🔥 Message will delete in {selfDestructTimer < 60 ? `${selfDestructTimer}m` : selfDestructTimer < 1440 ? `${Math.floor(selfDestructTimer/60)}h` : `${Math.floor(selfDestructTimer/1440)}d`}
              </span>
            )}
          </div>
          
          <div className="flex gap-3">
            <input
              className="flex-1 bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 outline-none focus:ring-2 ring-blue-500 focus:bg-gray-600 transition-all"
              placeholder={
                active 
                  ? `Message @${active}...`
                  : 'Select a contact first'
              }
              value={input}
              disabled={!active}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
            />
            <button 
              className="px-4 py-3 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors text-sm" 
              disabled={!active || !input.trim()} 
              onClick={() => setShowScheduleModal(true)}
              title="Schedule Message"
            >
              ⏰
            </button>
            <button 
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors" 
              disabled={!active || !input.trim()} 
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
        </footer>
      </section>

      {/* Schedule Message Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-white text-lg font-semibold mb-4">📅 Schedule Message</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">Send to: @{active}</label>
                <div className="bg-gray-700 rounded-lg p-3 text-gray-100 text-sm max-h-20 overflow-y-auto">
                  {input}
                </div>
              </div>
              
              <div>
                <label className="block text-gray-300 text-sm mb-2">Schedule for:</label>
                <input
                  type="datetime-local"
                  value={scheduledDateTime}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} // At least 1 minute from now
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded px-3 py-2"
                  title="Schedule date and time"
                  aria-label="Select schedule date and time"
                />
              </div>
              
              {selfDestructTimer > 0 && (
                <div className="text-orange-400 text-sm">
                  🔥 Message will self-destruct {selfDestructTimer < 60 ? `${selfDestructTimer}m` : selfDestructTimer < 1440 ? `${Math.floor(selfDestructTimer/60)}h` : `${Math.floor(selfDestructTimer/1440)}d`} after being sent
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={scheduleMessage}
                disabled={!scheduledDateTime}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


