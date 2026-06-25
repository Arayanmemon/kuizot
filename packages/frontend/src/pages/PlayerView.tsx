import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Navigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { AnswerFeedbackOverlay } from '../components/AnswerFeedbackOverlay';
import { Leaderboard } from '../components/Leaderboard';
import { useReducedMotion } from '../hooks/useReducedMotion';

export const PlayerView = () => {
  const {
    phase,
    currentQuestion,
    score,
    nickname,
    pin,
    userId,
    socket,
    hasAnswered,
    lastAnswerCorrect,
    leaderboard,
  } = useGameStore();

  const reduced = useReducedMotion();

  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [timerExpired, setTimerExpired] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);


  // Guard: no active game session → send to join page
  if (!pin) {
    return <Navigate to="/" replace />;
  }

  // Track when a new question starts — kick off the countdown
  useEffect(() => {
    if (phase === 'question' && currentQuestion) {
      const limit = currentQuestion.timeLimit; // in seconds
      setQuestionStartTime(Date.now());
      setTimeLeft(limit);
      setTimerExpired(false);


      // Clear any existing interval
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
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentQuestion?.id]); // re-run only when the question changes


  // Show feedback overlay when the player has answered, dismiss after 1500 ms
  useEffect(() => {
    if (hasAnswered) {
      setShowFeedback(true);
      // Stop the timer — no point counting down after answering
      if (timerRef.current) clearInterval(timerRef.current);
      const timer = setTimeout(() => setShowFeedback(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [hasAnswered]);

  const handleAnswerClick = (optionId: string) => {
    // Block if already answered or timer ran out
    if (!socket || !currentQuestion || hasAnswered || timerExpired) return;

    const timeTakenMs = Date.now() - questionStartTime;

    socket.emit('submit_answer', {
      pin,
      questionId: currentQuestion.id,
      userId,
      nickname,
      optionId,
      timeTakenMs,
    });
  };

  // Derive timer visuals
  const totalTime = currentQuestion?.timeLimit ?? 1;
  const timerPercent = Math.max(0, (timeLeft / totalTime) * 100);
  // Colour shifts: green → yellow → red as time runs out
  const timerColor =
    timerPercent > 50
      ? '#22c55e'   // green-500
      : timerPercent > 25
      ? '#eab308'   // yellow-500
      : '#ef4444';  // red-500

  const isLocked = hasAnswered || timerExpired;

  // framer-motion variants for the lobby entrance animation
  const lobbyVariants = reduced
    ? { hidden: { opacity: 1, y: 0 }, visible: { opacity: 1, y: 0 } }
    : { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

  return (
    <div className="gradient-bg min-h-screen flex flex-col">
      {/* Sticky header bar */}
      <header className="relative sticky top-0 bg-white/10 backdrop-blur-sm px-4 py-3 flex justify-between items-center">
        <span className="font-bold text-white">{nickname || 'Player'}</span>
        <span className="absolute left-1/2 -translate-x-1/2 font-black text-white text-sm tracking-tight">Kuizot</span>
        <span className="bg-white/20 text-white font-bold rounded-full px-3 py-1">
          {score} pts
        </span>
      </header>

      {/* Main content area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">

        {/* ── Lobby phase ── */}
        {phase === 'lobby' && (
          <motion.div
            className="text-center"
            variants={lobbyVariants}
            initial="hidden"
            animate="visible"
            transition={reduced ? { duration: 0 } : { duration: 0.5, ease: 'easeOut' }}
          >
            <h2 className="text-3xl font-black text-white">You're in!</h2>
            <p className="text-white/80 mt-2 animate-pulse">See your nickname on screen</p>
          </motion.div>
        )}

        {/* ── Question phase ── */}
        {phase === 'question' && (
          <div className="w-full max-w-lg flex flex-col gap-4">
            {/* Timer bar */}
            <div className="flex items-center gap-3">
              {/* Countdown number */}
              <span
                className="text-2xl font-black w-10 text-center tabular-nums"
                style={{ color: timerColor }}
              >
                {timeLeft}
              </span>
              {/* Progress bar */}
              <div className="flex-1 h-3 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-linear"
                  style={{ width: `${timerPercent}%`, backgroundColor: timerColor }}
                />
              </div>
            </div>

            {/* Time's up banner */}
            {timerExpired && !hasAnswered && (
              <div className="bg-red-500/30 border border-red-400/50 rounded-xl px-4 py-2 text-center text-white font-bold text-sm">
                ⏱ Time's up!
              </div>
            )}

            {/* Answer grid */}
            <div className="relative">
              <div className="grid grid-cols-2 gap-4">
                {(currentQuestion?.options || []).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleAnswerClick(opt.id)}
                    disabled={isLocked}
                    style={{ backgroundColor: opt.color }}
                    className={`w-full min-h-[120px] rounded-xl shadow-lg text-white font-bold text-xl transition-all ${
                      isLocked
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:brightness-110 active:scale-95'
                    }`}
                    aria-label={`Answer: ${opt.text}`}
                  >
                    {opt.text}
                  </button>
                ))}
              </div>

              {/* Feedback overlay rendered as absolute over the grid */}
              <AnswerFeedbackOverlay visible={showFeedback} isCorrect={lastAnswerCorrect} />
            </div>
          </div>
        )}

        {/* ── Leaderboard phase ── */}
        {phase === 'leaderboard' && (
          <Leaderboard entries={leaderboard} currentUserId={userId} />
        )}
      </div>
    </div>
  );
};
