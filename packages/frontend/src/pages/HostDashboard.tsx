import { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export const HostDashboard = () => {
  const { pin, phase, players, leaderboard, currentQuestion, setSessionData, setPhase, socket, isConnected } = useGameStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [answerCount, setAnswerCount] = useState(0);

  // Generate PIN by creating a session via socket
  const generatePin = () => {
    if (!socket || !isConnected) return;
    
    setIsGenerating(true);
    const hostId = `host_${Math.random().toString(36).substring(2, 11)}`;
    
    socket.emit('create_session', { hostId });
    
    socket.once('session_created', (data) => {
      setSessionData(data.pin, 'host', hostId);
      setIsGenerating(false);
    });
  };

  const startQuestion = () => {
    if (!socket || !pin) return;
    
    // For now, send a mock question (in a real app, this would come from the quiz DB)
    const mockQuestion = {
      pin,
      questionId: 'q_1',
      questionText: 'What is the capital of France?',
      options: [
        { id: 'a', text: 'Paris', color: '#ef4444' },
        { id: 'b', text: 'London', color: '#3b82f6' },
        { id: 'c', text: 'Berlin', color: '#eab308' },
        { id: 'd', text: 'Madrid', color: '#22c55e' },
      ],
      timeLimit: 20000,
      scoringMode: 'classic' as const,
      maxPoints: 1000,
    };
    
    setAnswerCount(0);
    socket.emit('start_question', mockQuestion);
    setPhase('question');
    
    // Listen for answers
    socket.on('answer_received', () => {
      setAnswerCount((prev) => prev + 1);
    });
  };

  const showLeaderboard = () => {
    if (!socket || !pin) return;
    
    socket.emit('show_leaderboard', { pin });
    socket.off('answer_received'); // Stop listening for answers
  };

  // If no PIN exists, show the setup screen
  if (!pin) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold mb-8">Host a new Game</h1>
        {!isConnected && (
          <p className="text-red-500 mb-4">Connecting to server...</p>
        )}
        <button
          onClick={generatePin}
          disabled={isGenerating || !isConnected}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 px-8 rounded shadow-lg text-2xl transition disabled:opacity-50"
        >
          {isGenerating ? 'Generating...' : 'Generate Game PIN'}
        </button>
      </div>
    );
  }

  // Lobby Phase
  if (phase === 'lobby') {
    return (
      <div className="flex-1 flex flex-col items-center p-8 bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-md text-center w-full max-w-3xl mb-8">
          <h2 className="text-2xl text-gray-500 mb-2">Join at www.example.com with Game PIN:</h2>
          <div className="text-7xl font-black tracking-widest text-gray-900">{pin}</div>
        </div>

        <div className="flex justify-between items-center w-full max-w-3xl mb-4">
          <h3 className="text-2xl font-bold">{players.length} Players</h3>
          <button
            onClick={startQuestion}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded shadow"
          >
            Start
          </button>
        </div>

        <div className="flex flex-wrap gap-4 w-full max-w-3xl">
          {players.length === 0 ? (
            <p className="text-gray-400 italic">Waiting for players...</p>
          ) : (
            players.map((p) => (
              <div key={p.userId} className="bg-purple-100 text-purple-900 font-bold px-4 py-2 rounded">
                {p.nickname}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Question Phase
  if (phase === 'question') {
    return (
      <div className="flex-1 flex flex-col p-8 bg-gray-50 h-full">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-4">{currentQuestion?.text || 'What is the capital of France?'}</h2>
          <div className="text-6xl font-black text-purple-600">20</div> {/* Mock Timer */}
          <div className="text-lg text-gray-500 mt-2">{answerCount} / {players.length} answered</div>
        </div>

        <div className="grid grid-cols-2 gap-4 flex-1 max-w-4xl w-full mx-auto">
          <div className="bg-red-500 rounded-xl flex items-center justify-center p-8 shadow-lg text-white text-3xl font-bold">
            Paris
          </div>
          <div className="bg-blue-500 rounded-xl flex items-center justify-center p-8 shadow-lg text-white text-3xl font-bold">
            London
          </div>
          <div className="bg-yellow-500 rounded-xl flex items-center justify-center p-8 shadow-lg text-white text-3xl font-bold">
            Berlin
          </div>
          <div className="bg-green-500 rounded-xl flex items-center justify-center p-8 shadow-lg text-white text-3xl font-bold">
            Madrid
          </div>
        </div>

        <div className="flex justify-end mt-8 max-w-4xl w-full mx-auto">
           <button onClick={showLeaderboard} className="bg-gray-800 text-white font-bold py-3 px-8 rounded hover:bg-gray-700">
             Skip / Show Results
           </button>
        </div>
      </div>
    );
  }

  // Leaderboard Phase
  if (phase === 'leaderboard') {
    return (
      <div className="flex-1 flex flex-col items-center p-8 bg-gray-50">
        <h2 className="text-4xl font-bold mb-8 text-purple-800">Top Players</h2>
        <div className="w-full max-w-2xl bg-white rounded-xl shadow-md p-6">
          {leaderboard.length === 0 ? (
            <p className="text-center text-gray-500">No scores yet!</p>
          ) : (
            leaderboard.map((entry, index) => (
              <div key={entry.userId} className="flex justify-between items-center py-4 border-b last:border-0">
                <div className="flex items-center gap-4">
                  <span className="text-2xl font-black text-gray-400">#{index + 1}</span>
                  <span className="text-xl font-bold">{entry.userId}</span> {/* Ideally nickname */}
                </div>
                <span className="text-2xl font-bold text-purple-600">{entry.score}</span>
              </div>
            ))
          )}
        </div>
        <div className="mt-8">
          <button onClick={() => setPhase('lobby')} className="text-gray-500 hover:text-gray-800 underline">
            Back to Lobby (Dev)
          </button>
        </div>
      </div>
    );
  }

  return null;
};
