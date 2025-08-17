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
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
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
  const [sessionStartTime] = useState(Date.now()); // Track when this session started
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Auto-cleanup expired messages and refresh timers
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const now = new Date();
        const filtered = prev.filter(m => !m.expires_at || new Date(m.expires_at) > now);
        
        // Debug: Log if messages are being filtered
        if (filtered.length !== prev.length) {
          console.log(`Filtered out ${prev.length - filtered.length} expired messages`);
        }
        
        return filtered;
      });
    }, 1000); // Check every 1 second for real-time countdown

    return () => clearInterval(interval);
  }, []);

  // Load contacts from Supabase
  useEffect(() => {
    async function loadContacts() {
      try {
        const response = await fetch(`/api/contacts?username=${me}`);
        if (response.ok) {
          const { contacts: contactList } = await response.json();
          setContacts(contactList);
          setActive(contactList[0] ?? null);
        }
      } catch (error) {
        console.error('Failed to load contacts:', error);
        // Fallback to localStorage if API fails
        const stored = typeof window !== 'undefined' ? localStorage.getItem('chat.contacts') : null;
        if (stored) {
          try {
            const list = JSON.parse(stored) as string[];
            setContacts(list);
            setActive(list[0] ?? null);
          } catch {}
        }
      }
    }
    
    if (me) {
      loadContacts();
    }
  }, [me]);

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

  async function addContact() {
    const u = window.prompt('Add contact by username:');
    if (!u) return;
    if (u === me) return alert('Cannot add yourself');
    if (contacts.includes(u)) return setActive(u);
    
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: me, contact: u })
      });
      
      if (response.ok) {
        const next = [...contacts, u];
        setContacts(next);
        setActive(u);
        // Also update localStorage as backup
        if (typeof window !== 'undefined') localStorage.setItem('chat.contacts', JSON.stringify(next));
      } else {
        const { error } = await response.json();
        alert(`Failed to add contact: ${error}`);
      }
    } catch (error) {
      console.error('Failed to add contact:', error);
      alert('Failed to add contact. Please try again.');
    }
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
      
      // Merge previous messages with current messages, removing duplicates
      if (data) {
        setMessages(prev => {
          const allMessages = [...(data as Message[])];
          // Add any optimistic messages that aren't in the database yet
          prev.forEach(msg => {
            if (msg.id.startsWith('optimistic-') && !allMessages.find(m => m.content === msg.content && m.created_at === msg.created_at)) {
              allMessages.push(msg);
            }
          });
          return allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });
      }
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
    
    // Debug: Log timer values
    console.log(`Self-destruct timer: ${selfDestructTimer} minutes`);
    console.log(`Message expires_at: ${optimistic.expires_at}`);
    console.log(`Current time: ${new Date().toISOString()}`);
    
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

  async function uploadFile(file: File) {
    if (!active || !file) return;
    
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sender', me);
      formData.append('receiver', active);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const { message } = await response.json();
        setMessages(prev => [...prev, message]);
      } else {
        const { error } = await response.json();
        alert(`Upload failed: ${error}`);
      }
    } catch (error) {
      console.error('File upload failed:', error);
      alert('File upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
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
      // Show optimistic messages (sent in this session) + very recent messages
      return messages.filter(m => 
        m.id.startsWith('optimistic-') || 
        new Date(m.created_at).getTime() >= sessionStartTime
      );
    }
    return messages;
  }, [messages, showPreviousMessages, sessionStartTime]);

  return (
    <div className="h-screen w-full flex flex-col md:grid md:grid-cols-[320px_1fr] overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      {/* Mobile Header */}
      <header className="md:hidden bg-gradient-to-r from-gray-800 to-gray-700 p-4 flex items-center justify-between border-b border-gray-600 flex-shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {me.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs text-gray-300">Signed in as</div>
            <div className="font-bold text-white text-lg">@{me}</div>
            {active && (
              <div className="text-xs text-blue-400 font-medium">Chat: @{active}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {active && (
            <button
              onClick={clearAllMessages}
              className="p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              🗑️
            </button>
          )}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-3 rounded-xl bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 shadow-lg hover:shadow-xl transition-all duration-200"
            title="Toggle menu"
            aria-label="Toggle mobile menu"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* Contacts Sidebar */}
      <aside className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block bg-gradient-to-b from-gray-800 to-gray-900 border-r border-gray-600 p-4 md:p-6 md:relative absolute top-20 left-0 right-0 z-10 h-full overflow-y-auto shadow-xl`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">👥</span>
            </div>
            <div className="font-bold text-white text-lg">Contacts</div>
          </div>
          <div className="flex gap-3">
            <button 
              className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm rounded-lg transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2" 
              onClick={addContact}
            >
              <span className="text-lg">+</span>
              Add
            </button>
            <button 
              className="p-2 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-gray-200 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg" 
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

        <div className="space-y-3">
          {contacts.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-3">👥</div>
              <div className="text-gray-300 font-medium mb-2">No contacts yet</div>
              <div className="text-gray-500 text-sm">Add your first contact to start chatting!</div>
            </div>
          ) : (
            contacts.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setActive(c);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                  active === c
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-gray-200 hover:shadow-lg hover:transform hover:scale-105'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    active === c 
                      ? 'bg-white/20' 
                      : 'bg-gradient-to-br from-gray-500 to-gray-600 group-hover:from-gray-400 group-hover:to-gray-500'
                  }`}>
                    {c.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-base">@{c}</div>
                    <div className={`text-xs ${active === c ? 'text-blue-100' : 'text-gray-400'}`}>
                      {active === c ? 'Active chat' : 'Click to chat'}
                    </div>
                  </div>
                  {active === c && (
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Chat Section */}
      <section className="flex flex-col h-full flex-1">
              {/* Desktop Header */}
      <header className="hidden md:block p-6 border-b border-gray-600 bg-gradient-to-r from-gray-800 to-gray-700 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {me.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm text-gray-300">Signed in as</div>
                <div className="font-bold text-white text-xl">@{me}</div>
              </div>
            </div>
            {active && (
              <div className="h-12 w-px bg-gradient-to-b from-gray-600 to-transparent"></div>
            )}
            {active && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse shadow-lg"></div>
                <div>
                  <div className="text-sm text-gray-300 font-medium">Chatting with</div>
                  <div className="font-bold text-white text-lg">@{active}</div>
                </div>
              </div>
            )}
          </div>
          {active && (
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowPreviousMessages(!showPreviousMessages)}
                className={`px-4 py-3 text-sm rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl ${
                  showPreviousMessages 
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white' 
                    : 'bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-gray-200'
                }`}
                title={showPreviousMessages ? "Hide previous messages" : "Show previous messages"}
              >
                {showPreviousMessages ? '🔒 Hide History' : '📜 Show History'}
              </button>
              <button
                onClick={clearAllMessages}
                className="px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white text-sm rounded-xl transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl"
                title="Clear this conversation"
              >
                🗑️ Clear Chat
              </button>
            </div>
          )}
        </div>
      </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-gray-900 min-h-0">
          {active ? (
            displayedMessages.length > 0 ? (
              <>

                {displayedMessages.map((m) => {
                  const isExpired = m.expires_at && new Date(m.expires_at) <= new Date();
                  const expiresIn = m.expires_at ? Math.max(0, Math.floor((new Date(m.expires_at).getTime() - Date.now()) / 1000)) : null;
                  
                  // Debug: Log timer values
                  if (m.expires_at) {
                    console.log(`Message ${m.id}: expires_at=${m.expires_at}, expiresIn=${expiresIn}s, isExpired=${isExpired}`);
                  }
                  
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
                      <div key={m.id} className={`flex ${m.sender_username === me ? 'justify-end' : 'justify-start'} group mb-4`}>
                        <div className={`max-w-[85%] md:max-w-[70%] px-5 py-4 rounded-2xl shadow-xl transition-all duration-300 hover:shadow-2xl ${
                          m.sender_username === me 
                            ? 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white' 
                            : 'bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 text-gray-100'
                        } ${expiresIn && expiresIn < 300 ? 'ring-2 ring-orange-400 ring-opacity-75 animate-pulse' : ''} hover:scale-105`}>
                          <div className="text-xs opacity-90 mb-3 flex items-center justify-between">
                            <span className="font-semibold flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                m.sender_username === me 
                                  ? 'bg-white/20' 
                                  : 'bg-gray-500/30'
                              }`}>
                                {m.sender_username.charAt(0).toUpperCase()}
                              </span>
                              @{m.sender_username}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs opacity-70 bg-black/10 px-2 py-1 rounded-full">
                                {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </span>
                              {expiresIn && (
                                <span className={`text-xs px-3 py-1 rounded-full font-medium shadow-lg ${
                                  expiresIn < 60 ? 'bg-gradient-to-r from-red-500 to-red-600 text-white' : 
                                  expiresIn < 300 ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white' : 
                                  'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black'
                                }`}>
                                  ⏱️ {expiresIn < 60 ? `${expiresIn}s` : expiresIn < 3600 ? `${Math.floor(expiresIn/60)}m` : `${Math.floor(expiresIn/3600)}h`}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="whitespace-pre-wrap break-words leading-relaxed text-base">
                            {m.content}
                            {m.file_url && (
                              <div className="mt-3 p-3 bg-black/10 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">
                                    {m.file_type?.startsWith('image/') ? '🖼️' : 
                                     m.file_type?.startsWith('video/') ? '🎥' : 
                                     m.file_type?.startsWith('audio/') ? '🎵' : '📎'}
                                  </span>
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{m.file_name}</div>
                                    <div className="text-xs opacity-70">
                                      {m.file_size ? `${(m.file_size / 1024).toFixed(1)} KB` : ''}
                                    </div>
                                  </div>
                                  <a 
                                    href={m.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-medium transition-colors"
                                  >
                                    View
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                })}
              </>
            ) : (
              <div className="text-gray-500 text-center">
                <div className="mb-2">💬 Start the conversation!</div>
                <div className="text-sm">Type a message below to begin chatting</div>

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
        <footer className="p-4 md:p-6 border-t border-gray-600 bg-gradient-to-r from-gray-800 to-gray-900 shadow-xl">
          {/* Self-Destruct Timer Selection */}
                      <div className="mb-4 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="text-gray-300 font-medium">⏱️ Self-destruct:</span>
                <select
                  value={selfDestructTimer}
                  onChange={(e) => setSelfDestructTimer(Number(e.target.value))}
                  className="bg-gray-700 text-white border border-gray-600 rounded-xl px-3 md:px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-md"
                  title="Self-destruct timer"
                  aria-label="Select self-destruct timer"
                >
                  <option value={0}>Never</option>
                  <option value={5}>5 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={1440}>24 hours</option>
                  <option value={10080}>7 days</option>
                </select>
              </div>
              {selfDestructTimer > 0 && (
                <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-gradient-to-r from-orange-900/40 to-red-900/40 border border-orange-600/50 rounded-xl shadow-lg">
                  <span className="text-orange-300 text-sm font-medium">
                    🔥 Message will delete in {selfDestructTimer < 60 ? `${selfDestructTimer}m` : selfDestructTimer < 1440 ? `${Math.floor(selfDestructTimer/60)}h` : `${Math.floor(selfDestructTimer/1440)}d`}
                  </span>
                </div>
              )}
            </div>
          
                      <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              <input
                className="flex-1 bg-gray-700 rounded-2xl px-4 md:px-5 py-3 md:py-4 text-white placeholder-gray-400 outline-none focus:ring-2 ring-blue-500 focus:bg-gray-600 transition-all text-base shadow-lg focus:shadow-xl"
                placeholder={
                  active 
                    ? `Type your message to @${active}...`
                    : 'Select a contact first'
                }
                value={input}
                disabled={!active}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendMessage();
                }}
              />
              <div className="flex gap-2 md:gap-3">
                <button 
                  className="px-4 md:px-5 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all text-sm shadow-lg hover:shadow-xl transform hover:scale-105" 
                  disabled={!active || isUploading} 
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload file"
                >
                  {isUploading ? '📤' : '📎'}
                </button>
                <button 
                  className="px-4 md:px-5 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all text-sm shadow-lg hover:shadow-xl transform hover:scale-105" 
                  disabled={!active || !input.trim()} 
                  onClick={() => setShowScheduleModal(true)}
                  title="Schedule Message"
                >
                  ⏰
                </button>
                <button 
                  className="px-6 md:px-8 py-3 md:py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105" 
                  disabled={!active || !input.trim()} 
                  onClick={sendMessage}
                >
                  Send
                </button>
              </div>
            </div>
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  uploadFile(file);
                  e.target.value = ''; // Reset input
                }
              }}
              accept="image/*,video/*,audio/*,text/*,.pdf,.zip,.doc,.docx,.txt"
              aria-label="File upload"
              title="File upload"
            />
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


