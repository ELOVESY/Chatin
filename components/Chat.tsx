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
    
    // Load existing messages for thread
    const loadMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_username.eq.${me},receiver_username.eq.${active}),and(sender_username.eq.${active},receiver_username.eq.${me})`)
        .order('created_at', { ascending: true });
      setMessages((data as Message[]) ?? []);
    };

    loadMessages();

    // Poll for new messages every 2 seconds (since Realtime isn't available)
    const pollInterval = setInterval(loadMessages, 2000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [me, active]);

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
    // Optimistic UI for sender
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
  }

  const grouped = useMemo(() => messages, [messages]);

  return (
    <div className="grid grid-cols-[240px_1fr] h-screen">
      <aside className="border-r border-gray-800 p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Contacts</div>
          <button className="text-sm text-blue-400" onClick={addContact}>Add</button>
        </div>
        <div className="space-y-1">
          {contacts.length === 0 && <div className="text-gray-500 text-sm">No contacts yet</div>}
          {contacts.map((c) => (
            <button
              key={c}
              onClick={() => setActive(c)}
              className={`w-full text-left px-3 py-2 rounded ${active === c ? 'bg-gray-800' : 'hover:bg-gray-900'}`}
            >
              @{c}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex flex-col h-full">
        <header className="p-4 border-b border-gray-800">
          <div className="text-sm text-gray-400">Signed in as</div>
          <div className="font-semibold">@{me}</div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {active ? (
            grouped.map((m) => (
              <div key={m.id} className={`flex ${m.sender_username === me ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] px-3 py-2 rounded-lg ${m.sender_username === me ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'}`}>
                  <div className="text-xs opacity-60 mb-1">@{m.sender_username}</div>
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-500">Select a contact to start chatting.</div>
          )}
        </div>
        <footer className="p-4 border-t border-gray-800">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-gray-900 rounded px-3 py-2 outline-none focus:ring-2 ring-blue-600"
              placeholder={active ? `Message @${active}` : 'Select a contact first'}
              value={input}
              disabled={!active}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
            />
            <button className="px-4 py-2 rounded bg-blue-600 disabled:opacity-50" disabled={!active || !input.trim()} onClick={sendMessage}>Send</button>
          </div>
        </footer>
      </section>
    </div>
  );
}


