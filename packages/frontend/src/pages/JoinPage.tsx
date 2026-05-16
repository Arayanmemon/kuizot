import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export const JoinPage = () => {
  const [inputPin, setInputPin] = useState('');
  const [inputNickname, setInputNickname] = useState('');
  const { setSessionData } = useGameStore();
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPin || !inputNickname) return;
    
    // In a real app, we'd emit 'join_session' to the socket here to validate the PIN
    // For the UI placeholder, we'll assume it works and transition.
    const tempUserId = `user_${Math.random().toString(36).substr(2, 9)}`;
    setSessionData(inputPin, 'player', tempUserId, inputNickname);
    navigate('/player');
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-purple-600 p-4">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">Join Game</h1>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Game PIN"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center text-2xl p-3 border-2 border-gray-300 rounded focus:border-purple-500 focus:outline-none"
            required
          />
          <input
            type="text"
            placeholder="Nickname"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            maxLength={15}
            className="text-center text-xl p-3 border-2 border-gray-300 rounded focus:border-purple-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            className="w-full bg-gray-900 text-white text-xl font-bold py-4 rounded hover:bg-gray-800 transition-colors"
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};
