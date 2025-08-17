'use client';
import { useState } from 'react';

interface NumericKeypadProps {
  onComplete: (password: string) => void;
  onCancel: () => void;
  title: string;
  subtitle?: string;
  maxLength?: number;
}

export default function NumericKeypad({ 
  onComplete, 
  onCancel, 
  title, 
  subtitle = "Enter your numeric password",
  maxLength = 6 
}: NumericKeypadProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleDigit = (digit: string) => {
    if (password.length < maxLength) {
      setPassword(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPassword('');
  };

  const handleSubmit = () => {
    if (password.length >= 4) {
      onComplete(password);
    }
  };

  const canSubmit = password.length >= 4;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-gray-600">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-3xl mb-3">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-gray-300">{subtitle}</p>
        </div>

        {/* Password Display */}
        <div className="mb-8">
          <div className="bg-gray-700 rounded-2xl p-4 text-center">
            <div className="text-2xl font-mono text-white mb-2">
              {showPassword ? password : '•'.repeat(password.length)}
            </div>
            <div className="text-sm text-gray-400">
              {password.length}/{maxLength} digits
            </div>
          </div>
          
          {/* Toggle Password Visibility */}
          <button
            onClick={() => setShowPassword(!showPassword)}
            className="w-full mt-3 text-center text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            {showPassword ? '🔒 Hide' : '👁️ Show'}
          </button>
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
            <button
              key={digit}
              onClick={() => handleDigit(digit.toString())}
              className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
            >
              {digit}
            </button>
          ))}
          
          {/* Bottom row */}
          <button
            onClick={handleClear}
            className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            Clear
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="w-16 h-16 bg-gradient-to-br from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white text-2xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 active:scale-95"
          >
            ←
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`flex-1 py-4 font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 ${
              canSubmit
                ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
