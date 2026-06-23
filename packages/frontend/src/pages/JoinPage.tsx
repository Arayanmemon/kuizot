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
            disabled={!isConnected}
            className="w-full bg-gray-900 text-white text-xl font-bold py-4 rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnected ? 'Enter' : 'Connecting...'}
          </button>
          
          {error && (
            <p className="text-red-500 text-center text-sm">{error}</p>
          )}
        </form>
      </div>
    </div>
  );
};
