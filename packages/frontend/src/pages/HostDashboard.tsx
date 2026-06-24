import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Leaderboard } from '../components/Leaderboard';

export const HostDashboard = () => {
  const {
    pin,
    phase,
    players,
    leaderboard,
    currentQuestion,
    setSessionData,
    setPhase,
    socket,
    isConnected,
  } = useGameStore();
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

  // ─── Setup Screen (no PIN) ───────────────────────────────────────────────
  if (!pin) {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-5xl font-black text-white mb-10 tracking-tight">Kuizot</h1>
        <button
          onClick={generatePin}
          disabled={isGenerating || !isConnected}
          className="bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-xl px-10 py-5 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? 'Generating...' : !isConnected ? 'Connecting...' : 'Generate Game PIN'}
        </button>
      </div>
    );
  }

  // ─── Lobby Phase ─────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center p-8">
        {/* Branding */}
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Kuizot</h1>

        {/* PIN display card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center w-full max-w-3xl mb-8">
          <p className="text-white/80 text-xl mb-2">Join at kuizot.app with PIN:</p>
          <div className="text-7xl font-black tracking-widest text-white">{pin}</div>
        </div>

        {/* Player count + Start button row */}
        <div className="flex justify-between items-center w-full max-w-3xl mb-4">
          <h3 className="text-2xl font-bold text-white">{players.length} Players</h3>
          <button
            onClick={startQuestion}
            className="bg-white text-purple-700 font-black text-lg rounded-2xl shadow-xl px-8 py-3 hover:bg-white/90 transition-colors"
          >
            Start
          </button>
        </div>

        {/* Player badge chips */}
        <div className="flex flex-wrap gap-3 w-full max-w-3xl">
          {players.length === 0 ? (
            <p className="text-white/60 italic">Waiting for players...</p>
          ) : (
            players.map((p) => (
              <div
                key={p.userId}
                className="bg-white/20 text-white font-bold rounded-full px-4 py-2"
              >
                {p.nickname}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ─── Question Phase ───────────────────────────────────────────────────────
  if (phase === 'question') {
    const opts = currentQuestion?.options ?? [];

    return (
      <div className="gradient-bg min-h-screen flex flex-col p-8">
        {/* Branding */}
        <h1 className="text-3xl font-black text-white mb-4 tracking-tight">Kuizot</h1>

        {/* Question text */}
        <h2 className="text-4xl font-black text-white text-center mb-6">
          {currentQuestion?.text ?? 'What is the capital of France?'}
        </h2>

        {/* Answer count indicator */}
        <div className="flex justify-center mb-6">
          <span className="bg-white/10 text-white font-bold rounded-full px-5 py-2 text-lg">
            {answerCount} / {players.length} answered
          </span>
        </div>

        {/* 2×2 answer grid */}
        <div className="grid grid-cols-2 gap-4 flex-1 max-w-4xl w-full mx-auto">
          {opts.length > 0 ? (
            opts.map((opt) => (
              <div
                key={opt.id}
                style={{ backgroundColor: opt.color }}
                className="rounded-2xl shadow-lg flex items-center justify-center p-8"
              >
                <span className="text-3xl font-bold text-white text-center">{opt.text}</span>
              </div>
            ))
          ) : (
            // Fallback mock panels matching existing behavior
            <>
              <div style={{ backgroundColor: '#ef4444' }} className="rounded-2xl shadow-lg flex items-center justify-center p-8">
                <span className="text-3xl font-bold text-white">Paris</span>
              </div>
              <div style={{ backgroundColor: '#3b82f6' }} className="rounded-2xl shadow-lg flex items-center justify-center p-8">
                <span className="text-3xl font-bold text-white">London</span>
              </div>
              <div style={{ backgroundColor: '#eab308' }} className="rounded-2xl shadow-lg flex items-center justify-center p-8">
                <span className="text-3xl font-bold text-white">Berlin</span>
              </div>
              <div style={{ backgroundColor: '#22c55e' }} className="rounded-2xl shadow-lg flex items-center justify-center p-8">
                <span className="text-3xl font-bold text-white">Madrid</span>
              </div>
            </>
          )}
        </div>

        {/* Skip / Show Results */}
        <div className="flex justify-end mt-8 max-w-4xl w-full mx-auto">
          <button
            onClick={showLeaderboard}
            className="bg-white/20 text-white font-bold py-3 px-8 rounded-2xl hover:bg-white/30 transition-colors"
          >
            Skip / Show Results
          </button>
        </div>
      </div>
    );
  }

  // ─── Leaderboard Phase ────────────────────────────────────────────────────
  if (phase === 'leaderboard') {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center p-8">
        {/* Branding */}
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Kuizot</h1>
        <Leaderboard entries={leaderboard} onBackToLobby={() => setPhase('lobby')} />
      </div>
    );
  }

  return null;
};
