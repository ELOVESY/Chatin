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
    const stored = getUsername();
    if (!stored) {
      let chosen = '';
      while (!chosen || !/^[A-Za-z0-9_]{3,32}$/.test(chosen)) {
        chosen = window.prompt('Set a username (3-32 chars, letters/numbers/underscore):', '') || '';
        if (!chosen) {
          // User cancelled - don't unlock
          return;
        }
        if (!/^[A-Za-z0-9_]{3,32}$/.test(chosen)) {
          alert('Username must be 3-32 characters long and contain only letters, numbers, and underscores.');
        }
      }
      setUsername(chosen);
      setUsernameState(chosen);
    }
    setUnlocked(true);
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <Calculator onUnlock={handleUnlock} />
      </main>
    );
  }

  const currentUsername = username ?? getUsername();
  
  if (!currentUsername) {
    // This shouldn't happen, but just in case - redirect back to calculator
    setUnlocked(false);
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <Calculator onUnlock={handleUnlock} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-900">
      <Chat me={currentUsername} />
    </main>
  );
}


