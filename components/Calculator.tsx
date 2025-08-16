'use client';
import { useState } from 'react';

export default function Calculator({ onUnlock }: { onUnlock: () => void }) {
  const [display, setDisplay] = useState('0');
  const [last6, setLast6] = useState('');

  function pushDigit(d: string) {
    if (!d) return;
    const next = (display === '0' ? d : display + d).slice(0, 18);
    setDisplay(next);
    const tail = (last6 + d).slice(-6);
    setLast6(tail);
    if (tail === '314159') onUnlock();
  }

  return (
    <div className="w-full max-w-xs p-4 bg-gray-900 rounded-lg shadow">
      <div className="text-right text-white text-2xl mb-3 h-10">{display}</div>
      <div className="grid grid-cols-4 gap-2">
        {['7','8','9','÷','4','5','6','×','1','2','3','-','0','.','=','+'].map((k) => (
          <button
            key={k}
            className="py-3 rounded bg-gray-700 text-white"
            onClick={() => pushDigit(/\d|\./.test(k) ? k : '')}
          >
            {k}
          </button>
        ))}
        <button
          className="col-span-4 py-3 rounded bg-red-600 text-white"
          onClick={() => {
            setDisplay('0');
            setLast6('');
          }}
        >
          Clear
        </button>
      </div>
    </div>
  );
}


