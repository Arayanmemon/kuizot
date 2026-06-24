import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';

export const JoinPage = () => {
  const [inputPin, setInputPin] = useState('');
  const [inputNickname, setInputNickname] = useState('');
  const [error, setError] = useState('');
  const { setSessionData, socket, isConnected } = useGameStore();
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!inputPin || !inputNickname) return;

    if (!socket || !isConnected) {
      setError('Not connected to server. Please wait...');
      return;
    }

    const userId = `user_${Math.random().toString(36).substring(2, 11)}`;

    // Emit join session event to server
    socket.emit('join_session', {
      pin: inputPin,
      nickname: inputNickname,
      userId,
    });

    // Listen for success response (one-time)
    socket.once('join_success', () => {
      setSessionData(inputPin, 'player', userId, inputNickname);
      navigate('/player');
    });

    // Listen for error response (one-time)
    socket.once('join_error', (data) => {
      setError(data.message);
    });
  };

  return (
    <div className="gradient-bg min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="font-black text-white text-4xl mb-8 tracking-tight">Kuizot</h1>

      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Game PIN"
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value.toUpperCase())}
            maxLength={6}
            className="w-full text-center text-2xl p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors"
            required
          />
          <input
            type="text"
            placeholder="Nickname"
            value={inputNickname}
            onChange={(e) => setInputNickname(e.target.value)}
            maxLength={15}
            className="w-full text-center text-xl p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors"
            required
          />
          <button
            type="submit"
            disabled={!isConnected}
            className="w-full bg-gray-900 text-white text-xl font-bold py-4 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnected ? 'Enter' : 'Connecting...'}
          </button>

          {error && (
            <p className="text-red-400 text-center text-sm mt-1">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
};
