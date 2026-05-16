import { useGameStore } from '../store/gameStore';

export const PlayerView = () => {
  const { phase, currentQuestion, score, nickname } = useGameStore();

  // Mock answers for UI development if not provided by store
  const mockOptions = currentQuestion?.options || [
    { id: 'a', text: 'Option Red', color: '#ef4444' }, // red-500
    { id: 'b', text: 'Option Blue', color: '#3b82f6' }, // blue-500
    { id: 'c', text: 'Option Yellow', color: '#eab308' }, // yellow-500
    { id: 'd', text: 'Option Green', color: '#22c55e' }, // green-500
  ];

  const handleAnswerClick = (optionId: string) => {
    // In the real implementation, emit socket event here
    console.log('Answer clicked:', optionId);
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
            {mockOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAnswerClick(opt.id)}
                style={{ backgroundColor: opt.color }}
                className="w-full h-full min-h-[120px] rounded-lg shadow-md hover:brightness-110 active:scale-95 transition-all"
                aria-label={`Answer ${opt.id}`}
              />
            ))}
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
