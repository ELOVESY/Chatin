'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const Calculator = dynamic(() => import('@/components/Calculator'), { ssr: false });
const Chat = dynamic(() => import('@/components/Chat'), { ssr: false });
import { getUsername, setUsername } from '@/utils/username';

export default function HomePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [username, setUsernameState] = useState<string | null>(null);

  useEffect(() => {
    setUsernameState(getUsername());
  }, []);

  function handleUnlock() {
    setUnlocked(true);
    const stored = getUsername();
    if (!stored) {
      const chosen = window.prompt('Set a username (3-32 chars, letters/numbers/underscore):', '');
      if (chosen && /^[A-Za-z0-9_]{3,32}$/.test(chosen)) {
        setUsername(chosen);
        setUsernameState(chosen);
      }
    }
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <Calculator onUnlock={handleUnlock} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <Chat me={username ?? getUsername() ?? ''} />
    </main>
  );
}


