'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabaseClient';

type Message = {
  id: string;
  sender_username: string;
  receiver_username: string;
  content: string;
  created_at: string;
};

export default function Chat({ me }: { me: string }) {
  const [contacts, setContacts] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [showPreviousMessages, setShowPreviousMessages] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

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
      return;
    }
    
    // Send normal message (always allowed)
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_username: me,
      receiver_username: active,
      content,
      created_at: new Date().toISOString()
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: me, receiver: active, content })
    });
    if (!res.ok) {
      alert('Failed to send');
    }
    
    // Close mobile menu after sending
    setIsMobileMenuOpen(false);
  }

  const displayedMessages = messages;

  return (
    <div className="h-screen flex flex-col md:grid md:grid-cols-[280px_1fr]">
      {/* Mobile Header */}
      <header className="md:hidden bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
        <div>
          <div className="text-sm text-gray-400">Signed in as</div>
          <div className="font-semibold">@{me}</div>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded bg-gray-700 hover:bg-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {/* Contacts Sidebar */}
      <aside className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:block bg-gray-800 border-r border-gray-700 p-4 md:relative absolute top-16 left-0 right-0 z-10 max-h-[calc(100vh-4rem)] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-4">
          <div className="font-semibold text-white">Contacts</div>
          <button className="text-sm text-blue-400 hover:text-blue-300" onClick={addContact}>
            Add
          </button>
        </div>
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
          <div className="text-sm text-gray-400">Signed in as</div>
          <div className="font-semibold text-white">@{me}</div>
          {active && (
            <div className="text-sm text-gray-400 mt-1">
              Chatting with @{active} {!showPreviousMessages && '(Previous messages hidden for privacy)'}
            </div>
          )}
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
                {displayedMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_username === me ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] px-4 py-3 rounded-2xl ${
                      m.sender_username === me 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-100'
                    }`}>
                      <div className="text-xs opacity-70 mb-1">@{m.sender_username}</div>
                      <div className="whitespace-pre-wrap break-words">{m.content}</div>
                    </div>
                  </div>
                ))}
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
              className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors" 
              disabled={!active || !input.trim()} 
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}


