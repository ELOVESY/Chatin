'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
const Calculator = dynamic(() => import('@/components/Calculator'), { ssr: false });
const Chat = dynamic(() => import('@/components/Chat'), { ssr: false });
const NumericKeypad = dynamic(() => import('@/components/NumericKeypad'), { ssr: false });
import { getUsername, setUsername } from '@/utils/username';

export default function HomePage() {
  const [unlocked, setUnlocked] = useState(false);
  const [username, setUsernameState] = useState<string | null>(null);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showPasswordVerify, setShowPasswordVerify] = useState(false);
  const [pendingUsername, setPendingUsername] = useState<string>('');

  async function checkUsernameExists(username: string): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password: 'dummy' })
      });
      return response.status === 401; // 401 means user exists but wrong password
    } catch {
      return false; // Assume user doesn't exist on error
    }
  }

  async function handlePasswordSetup(password: string) {
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pendingUsername, password })
      });
      
      if (response.ok) {
        setUsername(pendingUsername);
        setUsernameState(pendingUsername);
        setShowPasswordSetup(false);
        setUnlocked(true);
      } else {
        const { error } = await response.json();
        alert(`Failed to setup password: ${error}`);
      }
    } catch (error) {
      alert('Failed to setup password. Please try again.');
    }
  }

  async function handlePasswordVerify(password: string) {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: pendingUsername, password })
      });
      
      if (response.ok) {
        setUsername(pendingUsername);
        setUsernameState(pendingUsername);
        setShowPasswordVerify(false);
        setUnlocked(true);
      } else {
        const { error } = await response.json();
        alert(`Verification failed: ${error}`);
      }
    } catch (error) {
      alert('Verification failed. Please try again.');
    }
  }

  useEffect(() => {
    setUsernameState(getUsername());
  }, []);

  async function handleUnlock() {
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
      
      // Check if username exists
      const exists = await checkUsernameExists(chosen);
      if (exists) {
        // Username exists, show password verification
        setPendingUsername(chosen);
        setShowPasswordVerify(true);
      } else {
        // New username, show password setup
        setPendingUsername(chosen);
        setShowPasswordSetup(true);
      }
    } else {
      setUsername(stored);
      setUsernameState(stored);
      setUnlocked(true);
    }
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <Calculator onUnlock={handleUnlock} />
        
        {/* Password Setup Modal */}
        {showPasswordSetup && (
          <NumericKeypad
            title="Set Password"
            subtitle={`Create a numeric password for @${pendingUsername}`}
            onComplete={handlePasswordSetup}
            onCancel={() => setShowPasswordSetup(false)}
            maxLength={6}
          />
        )}
        
        {/* Password Verification Modal */}
        {showPasswordVerify && (
          <NumericKeypad
            title="Enter Password"
            subtitle={`Enter password for @${pendingUsername}`}
            onComplete={handlePasswordVerify}
            onCancel={() => setShowPasswordVerify(false)}
            maxLength={6}
          />
        )}
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


