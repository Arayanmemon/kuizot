import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useAuthStore } from '../store/authStore';
import { Leaderboard } from '../components/Leaderboard';
import { QuestionMedia } from '../components/QuestionMedia';
import api from '../lib/api';
import { useAudio } from '../hooks/useAudio';

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
    questionStats,
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

  // True once the game has been played through (returned to lobby after last question)
  const [gameCompleted, setGameCompleted] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Audio hooks for timer music and leaderboard music
  const timerAudio = useAudio('/sounds/timer-music.mp3', {
    loop: true,
    volume: 0.3,
    respectReducedMotion: true,
  });
  const leaderboardAudio = useAudio('/sounds/leaderboard-music.mp3', {
    loop: false,
    volume: 0.4,
    respectReducedMotion: true,
  });

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
    setTimerExpired(false);
    socket.off('answer_received'); // prevent listener accumulation
    socket.on('answer_received', () => {
      setAnswerCount((prev) => prev + 1);
    });

    socket.emit('start_question', { pin, questionIndex: index });
    setCurrentQuestionIndex(index + 1);
    setPhase('question');
  };

  // Start/reset the countdown whenever phase changes to 'question' and we have a timeLimit
  useEffect(() => {
    if (phase === 'question' && currentQuestion) {
      const limit = currentQuestion.timeLimit; // seconds
      setTimeLeft(limit);
      setTimerExpired(false);

      // Start timer music
      timerAudio.play();

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Stop timer music when leaving question phase
      timerAudio.stop();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentQuestion?.id]);

  // Play leaderboard music when entering leaderboard phase
  useEffect(() => {
    if (phase === 'leaderboard') {
      leaderboardAudio.play();
    } else {
      leaderboardAudio.stop();
    }
  }, [phase]);

  // Host clicks "Start" in the lobby for the first question
  const startFirstQuestion = () => {
    setGameCompleted(false);
    fireQuestion(0);
  };

  // Host clicks "Next Question" from the leaderboard
  const nextQuestion = () => {
    socket?.emit('show_leaderboard', { pin }); // already on leaderboard, no-op but harmless
    fireQuestion(currentQuestionIndex);
  };

  // Show question stats after a question ends (new flow)
  const showQuestionStats = () => {
    if (!socket || !pin) return;
    socket.off('answer_received');
    timerAudio.stop();
    socket.emit('show_question_stats', { pin });
  };

  // From stats screen, proceed to leaderboard
  const showLeaderboard = () => {
    if (!socket || !pin) return;
    socket.emit('show_leaderboard', { pin });
  };

  // End the game and go back to lobby
  const endGame = () => {
    if (!socket || !pin) return;
    socket.emit('end_game', { pin });
    setGameCompleted(true);
    setPhase('lobby');
  };

  // Fully exit the session back to the quiz selector
  const exitSession = () => {
    // Tell the server to notify all players to clear their state
    if (socket && pin) {
      socket.emit('close_session', { pin });
    }
    // Reset game store session data so pin is cleared and we go back to the selector
    const { resetStore } = useGameStore.getState();
    resetStore();
    setGameCompleted(false);
    setCurrentQuestionIndex(0);
    setTotalQuestions(0);
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
          <div className="flex gap-3">
            {gameCompleted && (
              <button
                onClick={exitSession}
                className="bg-red-500/80 hover:bg-red-500 text-white font-black text-lg rounded-2xl shadow-xl px-6 py-3 transition-colors"
              >
                End Session
              </button>
            )}
            <button
              onClick={startFirstQuestion}
              disabled={players.length === 0}
              title={players.length === 0 ? 'Waiting for players to join…' : undefined}
              className="bg-white text-purple-700 font-black text-lg rounded-2xl shadow-xl px-8 py-3 hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {gameCompleted ? 'Play Again' : 'Start'}
            </button>
          </div>
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
    const displayedQuestionNum = currentQuestionIndex;
    const totalTime = currentQuestion?.timeLimit ?? 1;
    const timerPercent = Math.max(0, (timeLeft / totalTime) * 100);
    const timerColor =
      timerPercent > 50 ? '#22c55e' : timerPercent > 25 ? '#eab308' : '#ef4444';

    return (
      <div className="gradient-bg min-h-screen flex flex-col p-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-black text-white tracking-tight">Kuizot</h1>
          <span className="bg-white/20 text-white font-bold rounded-full px-4 py-1.5 text-sm">
            Q {displayedQuestionNum} / {totalQuestions}
          </span>
        </div>

        {/* Timer bar */}
        <div className="flex items-center gap-3 mb-4 max-w-4xl w-full mx-auto">
          <span
            className="text-3xl font-black w-12 text-center tabular-nums"
            style={{ color: timerColor }}
          >
            {timeLeft}
          </span>
          <div className="flex-1 h-4 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${timerPercent}%`, backgroundColor: timerColor }}
            />
          </div>
        </div>

        <h2 className="text-4xl font-black text-white text-center mb-6">
          {currentQuestion?.text ?? 'Loading question…'}
        </h2>

        {/* Question media — shown on host screen so host sees what players see */}
        {currentQuestion?.imageUrl && (
          <div className="max-w-2xl w-full mx-auto mb-6">
            <QuestionMedia url={currentQuestion.imageUrl} />
          </div>
        )}

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
            onClick={showQuestionStats}
            className="bg-white/20 text-white font-bold py-3 px-8 rounded-2xl hover:bg-white/30 transition-colors"
          >
            {timerExpired ? 'Show Results' : 'Skip / Show Results'}
          </button>
        </div>
      </div>
    );
  }

  // ─── Stats Phase ──────────────────────────────────────────────────────────
  if (phase === 'stats') {
    const opts = questionStats?.options ?? [];
    const maxCount = Math.max(...opts.map((o) => o.count), 1);

    return (
      <div className="gradient-bg min-h-screen flex flex-col p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-white tracking-tight">Kuizot</h1>
          <span className="bg-white/20 text-white font-bold rounded-full px-4 py-1.5 text-sm">
            Q {currentQuestionIndex} / {totalQuestions}
          </span>
        </div>

        <h2 className="text-3xl font-black text-white text-center mb-8">
          {questionStats?.questionText ?? currentQuestion?.text ?? ''}
        </h2>

        {/* Option bars */}
        <div className="flex flex-col gap-4 max-w-3xl w-full mx-auto flex-1">
          {opts.map((opt) => (
            <div key={opt.id} className="flex items-center gap-4">
              {/* Correct tick */}
              <span className="text-2xl w-8 text-center shrink-0">
                {opt.isCorrect ? '✅' : ''}
              </span>
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-white font-semibold text-sm truncate">{opt.text}</span>
                  <span className="text-white/70 text-sm font-bold ml-2 shrink-0">
                    {opt.count} ({opt.percent}%)
                  </span>
                </div>
                <div className="h-8 bg-white/10 rounded-xl overflow-hidden">
                  <div
                    className="h-full rounded-xl transition-all duration-700 ease-out"
                    style={{
                      width: `${(opt.count / maxCount) * 100}%`,
                      backgroundColor: opt.isCorrect ? '#22c55e' : opt.color,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mt-8 max-w-3xl w-full mx-auto">
          <span className="text-white/60 text-sm">
            {questionStats?.totalAnswers ?? 0} / {players.length} answered
          </span>
          <button
            onClick={showLeaderboard}
            className="bg-white text-purple-700 font-black text-lg rounded-2xl shadow-xl px-8 py-3 hover:bg-white/90 transition-colors"
          >
            Show Leaderboard →
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
