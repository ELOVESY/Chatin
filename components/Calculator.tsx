'use client';
import { useState } from 'react';

export default function Calculator({ onUnlock }: { onUnlock: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);
  const [secretSequence, setSecretSequence] = useState('');

  function inputDigit(digit: string) {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
    
    // Track secret sequence
    const newSequence = (secretSequence + digit).slice(-8);
    setSecretSequence(newSequence);
    if (newSequence === '0+314519') {
      onUnlock();
    }
  }

  function inputOperation(nextOperation: string) {
    const inputValue = parseFloat(display);

    if (prevValue === null) {
      setPrevValue(inputValue);
    } else if (operation) {
      const currentValue = prevValue || 0;
      const newValue = performCalculation();
      
      setDisplay(String(newValue));
      setPrevValue(newValue);
    }

    setWaitingForNewValue(true);
    setOperation(nextOperation);
    
    // Track operation in secret sequence
    const newSequence = (secretSequence + nextOperation).slice(-8);
    setSecretSequence(newSequence);
    if (newSequence === '0+314519') {
      onUnlock();
    }
  }

  function performCalculation() {
    const inputValue = parseFloat(display);
    const currentValue = prevValue || 0;

    switch (operation) {
      case '+':
        return currentValue + inputValue;
      case '-':
        return currentValue - inputValue;
      case '×':
        return currentValue * inputValue;
      case '÷':
        return inputValue !== 0 ? currentValue / inputValue : 0;
      default:
        return inputValue;
    }
  }

  function calculate() {
    if (prevValue !== null && operation) {
      const newValue = performCalculation();
      setDisplay(String(newValue));
      setPrevValue(null);
      setOperation(null);
      setWaitingForNewValue(true);
    }
  }

  function clear() {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setWaitingForNewValue(false);
    setSecretSequence('');
  }

  function inputDecimal() {
    if (waitingForNewValue) {
      setDisplay('0.');
      setWaitingForNewValue(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto p-6 bg-gray-900 rounded-2xl shadow-2xl border border-gray-700">
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <div className="text-right text-white text-3xl font-mono h-12 flex items-center justify-end overflow-hidden">
          {display}
        </div>
        {operation && (
          <div className="text-right text-gray-400 text-sm mt-1">
            {prevValue} {operation}
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-4 gap-3">
        {/* Row 1 */}
        <button
          className="col-span-2 py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors"
          onClick={clear}
        >
          Clear
        </button>
        <button
          className="py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
          onClick={() => inputOperation('÷')}
        >
          ÷
        </button>
        <button
          className="py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
          onClick={() => inputOperation('×')}
        >
          ×
        </button>

        {/* Row 2 */}
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('7')}
        >
          7
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('8')}
        >
          8
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('9')}
        >
          9
        </button>
        <button
          className="py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
          onClick={() => inputOperation('-')}
        >
          -
        </button>

        {/* Row 3 */}
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('4')}
        >
          4
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('5')}
        >
          5
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('6')}
        >
          6
        </button>
        <button
          className="py-4 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold transition-colors"
          onClick={() => inputOperation('+')}
        >
          +
        </button>

        {/* Row 4 */}
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('1')}
        >
          1
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('2')}
        >
          2
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('3')}
        >
          3
        </button>
        <button
          className="row-span-2 py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
          onClick={calculate}
        >
          =
        </button>

        {/* Row 5 */}
        <button
          className="col-span-2 py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={() => inputDigit('0')}
        >
          0
        </button>
        <button
          className="py-4 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-xl font-semibold transition-colors"
          onClick={inputDecimal}
        >
          .
        </button>
      </div>
    </div>
  );
}


