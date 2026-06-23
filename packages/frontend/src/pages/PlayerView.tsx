import { useState, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

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
    lastAnswerCorrect 
  } = useGameStore();
  
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);

  // Track when a new question starts
  useEffect(() => {
    if (phase === 'question' && currentQuestion) {
      setQuestionStartTime(Date.now());
    }
  }, [phase, currentQuestion]);

  const handleAnswerClick = (optionId: string) => {
    if (!socket || !currentQuestion || hasAnswered) return;
    
    const timeTakenMs = Date.now() - questionStartTime;
    
    // For now, we'll hardcode the correct answer as 'a' (Paris)
    // In a real app, this would come from the backend or be encrypted
    const correctOptionId = 'a';
    
    socket.emit('submit_answer', {
      pin,
      questionId: currentQuestion.id,
      userId,
      nickname,
      optionId,
      timeTakenMs,
      scoringMode: currentQuestion.scoringMode || 'classic',
      maxPoints: currentQuestion.maxPoints || 1000,
      timeLimit: currentQuestion.timeLimit,
      correctOptionId,
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 h-full">
      {/* Header bar */}
      <div className="bg-white px-4 py-3 shadow-sm flex justify-between items-center border-b">
        <span className="font-semibold text-gray-700">{nickname || 'Player'}</span>
        <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full font-bold">
          {score} pts
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {phase === 'lobby' && (
          <div className="text-center animate-pulse">
            <h2 className="text-2xl font-bold text-gray-600">You're in!</h2>
            <p className="text-gray-500 mt-2">See your nickname on screen</p>
          </div>
        )}

        {phase === 'question' && (
          <div className="w-full max-w-lg h-full max-h-[600px] grid grid-cols-2 gap-4">
            {(currentQuestion?.options || []).map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAnswerClick(opt.id)}
                disabled={hasAnswered}
                style={{ backgroundColor: opt.color }}
                className={`w-full h-full min-h-[120px] rounded-lg shadow-md transition-all ${
                  hasAnswered 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:brightness-110 active:scale-95'
                }`}
                aria-label={`Answer ${opt.id}`}
              >
                {opt.text}
              </button>
            ))}
            {hasAnswered && (
              <div className="col-span-2 text-center mt-4">
                {lastAnswerCorrect ? (
                  <p className="text-green-600 text-xl font-bold">Correct! 🎉</p>
                ) : (
                  <p className="text-red-600 text-xl font-bold">Wrong! 😢</p>
                )}
              </div>
            )}
          </div>
        )}

        {phase === 'leaderboard' && (
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Pencils down!</h2>
            <p className="text-xl text-gray-600">Check the main screen to see how you did.</p>
          </div>
        )}
      </div>
    </div>
  );
};
