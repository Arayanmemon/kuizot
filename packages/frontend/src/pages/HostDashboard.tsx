import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { Leaderboard } from '../components/Leaderboard';
import api from '../lib/api';

interface Quiz {
  id: string;
  title: string;
  questions?: { id: string }[];
}

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

  const [searchParams] = useSearchParams();
  const preselectedQuizId = searchParams.get('quizId');
  const { user } = useAuthStore();

  // Quiz selector state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(preselectedQuizId);

  const [isGenerating, setIsGenerating] = useState(false);
  const [answerCount, setAnswerCount] = useState(0);

  // Track question progress
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Fetch quizzes for the selector
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get<Quiz[]>('/quizzes');
        setQuizzes(data);
      } catch (err) {
        console.error('Failed to load quizzes', err);
      } finally {
        setQuizzesLoading(false);
      }
    };
    load();
  }, []);

  // Generate PIN by creating a session via socket with quizId
  const generatePin = async (quizId: string) => {
    if (!socket || !isConnected || !user) return;

    setIsGenerating(true);

    // Fetch the question count for this quiz so we know when we've hit the last question
    let questionCount = 0;
    try {
      const { data } = await api.get<{ id: string }[]>(`/quizzes/${quizId}/questions`);
      questionCount = data.length;
    } catch (err) {
      console.error('Failed to fetch question count', err);
    }

    const hostId = user.id;

    socket.emit('create_session', { hostId, quizId });

    socket.once('session_created', (data: { pin: string }) => {
      setSessionData(data.pin, 'host', hostId);
      setCurrentQuestionIndex(0);
      setTotalQuestions(questionCount);
      setIsGenerating(false);
    });
  };

  // Fire the question at `currentQuestionIndex` and increment the counter
  const fireQuestion = (index: number) => {
    if (!socket || !pin) return;

    setAnswerCount(0);
    socket.off('answer_received'); // prevent listener accumulation
    socket.on('answer_received', () => {
      setAnswerCount((prev) => prev + 1);
    });

    socket.emit('start_question', { pin, questionIndex: index });
    setCurrentQuestionIndex(index + 1);
    setPhase('question');
  };

  // Host clicks "Start" in the lobby for the first question
  const startFirstQuestion = () => fireQuestion(0);

  // Host clicks "Next Question" from the leaderboard
  const nextQuestion = () => {
    socket?.emit('show_leaderboard', { pin }); // already on leaderboard, no-op but harmless
    fireQuestion(currentQuestionIndex);
  };

  // Show the leaderboard after a question ends
  const showLeaderboard = () => {
    if (!socket || !pin) return;
    socket.off('answer_received');
    socket.emit('show_leaderboard', { pin });
  };

  // End the game and go back to lobby
  const endGame = () => {
    if (!socket || !pin) return;
    socket.emit('end_game', { pin });
    setPhase('lobby');
  };

  const isLastQuestion = currentQuestionIndex >= totalQuestions;

  // ─── Quiz Selector Screen (no PIN yet) ───────────────────────────────────
  if (!pin) {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center justify-center p-6">
        <h1 className="text-5xl font-black text-white mb-10 tracking-tight">Kuizot</h1>

        <div className="w-full max-w-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">Choose a Quiz</h2>

          {quizzesLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white/10 rounded-2xl p-5 animate-pulse">
                  <div className="h-5 bg-white/20 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-white/10 rounded w-1/4" />
                </div>
              ))}
            </div>
          ) : quizzes.length === 0 ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
              <p className="text-white/70 text-lg">No quizzes found.</p>
              <p className="text-white/50 text-sm mt-1">
                Create a quiz from your dashboard first.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 mb-8 max-h-80 overflow-y-auto pr-1">
              {quizzes.map((quiz) => {
                const isSelected = selectedQuizId === quiz.id;
                const questionCount = quiz.questions?.length ?? 0;
                return (
                  <button
                    key={quiz.id}
                    onClick={() => setSelectedQuizId(quiz.id)}
                    className={`w-full text-left rounded-2xl p-5 border-2 transition-colors ${
                      isSelected
                        ? 'bg-white/20 border-white text-white'
                        : 'bg-white/10 border-transparent text-white hover:bg-white/15'
                    }`}
                  >
                    <div className="font-bold text-lg">{quiz.title}</div>
                    {questionCount > 0 && (
                      <div className="text-white/60 text-sm mt-0.5">
                        {questionCount} {questionCount === 1 ? 'question' : 'questions'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <button
            onClick={() => { if (selectedQuizId) void generatePin(selectedQuizId); }}
            disabled={!selectedQuizId || isGenerating || !isConnected || !user}
            className="w-full bg-white text-purple-700 font-black text-2xl rounded-2xl shadow-xl px-10 py-5 hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating
              ? 'Generating…'
              : !isConnected
              ? 'Connecting…'
              : !selectedQuizId
              ? 'Select a Quiz First'
              : 'Start Session'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Lobby Phase ─────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="gradient-bg min-h-screen flex flex-col items-center p-8">
        <h1 className="text-4xl font-black text-white mb-8 tracking-tight">Kuizot</h1>

        <div className="bg-white/10 backdrop-blur-sm rounded-2xl shadow-xl p-8 text-center w-full max-w-3xl mb-8">
          <p className="text-white/80 text-xl mb-2">Join at kuizot.app with PIN:</p>
          <div className="text-7xl font-black tracking-widest text-white">{pin}</div>
        </div>

        <div className="flex justify-between items-center w-full max-w-3xl mb-4">
          <h3 className="text-2xl font-bold text-white">{players.length} Players</h3>
          <button
            onClick={startFirstQuestion}
            className="bg-white text-purple-700 font-black text-lg rounded-2xl shadow-xl px-8 py-3 hover:bg-white/90 transition-colors"
          >
            Start
          </button>
        </div>

        <div className="flex flex-wrap gap-3 w-full max-w-3xl">
          {players.length === 0 ? (
            <p className="text-white/60 italic">Waiting for players…</p>
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
    // currentQuestionIndex was already incremented when fireQuestion was called,
    // so the displayed number = currentQuestionIndex (1-based)
    const displayedQuestionNum = currentQuestionIndex;

    return (
      <div className="gradient-bg min-h-screen flex flex-col p-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-black text-white tracking-tight">Kuizot</h1>
          <span className="bg-white/20 text-white font-bold rounded-full px-4 py-1.5 text-sm">
            Q {displayedQuestionNum} / {totalQuestions}
          </span>
        </div>

        <h2 className="text-4xl font-black text-white text-center mb-6">
          {currentQuestion?.text ?? 'Loading question…'}
        </h2>

        <div className="flex justify-center mb-6">
          <span className="bg-white/10 text-white font-bold rounded-full px-5 py-2 text-lg">
            {answerCount} / {players.length} answered
          </span>
        </div>

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
            <div className="col-span-2 flex items-center justify-center text-white/50 text-xl">
              Loading options…
            </div>
          )}
        </div>

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
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Kuizot</h1>
        <Leaderboard
          entries={leaderboard}
          // Pass next-question handler only when more questions remain;
          // otherwise pass the end-game/back-to-lobby handler
          onNextQuestion={isLastQuestion ? undefined : nextQuestion}
          onBackToLobby={isLastQuestion ? endGame : undefined}
        />
      </div>
    );
  }

  return null;
};
