import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useGameStore } from './store/gameStore';

import { JoinPage } from './pages/JoinPage';
import { PlayerView } from './pages/PlayerView';
import { HostDashboard } from './pages/HostDashboard';

function App() {
  const { 
    setSocket, 
    setConnected, 
    setPhase, 
    setCurrentQuestion, 
    setLeaderboard, 
    addPlayer, 
    removePlayer,
    setScore,
    setHasAnswered,
    setLastAnswerCorrect,
  } = useGameStore();

  useEffect(() => {
    // Connect to the backend /game namespace
    const newSocket = io('http://localhost:3000/game', {
      autoConnect: true,
    });
    
    newSocket.on('connect', () => {
      console.log('Connected to GameServer with ID:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from GameServer');
      setConnected(false);
    });

    // Player events
    newSocket.on('join_success', (data) => {
      console.log('Successfully joined session:', data);
    });

    newSocket.on('join_error', (data) => {
      console.error('Failed to join session:', data.message);
      alert(data.message);
    });

    newSocket.on('question_started', (data) => {
      console.log('Question started:', data);
      setCurrentQuestion({
        id: data.questionId,
        text: data.questionText,
        options: data.options,
        timeLimit: data.timeLimit,
        scoringMode: data.scoringMode,
        maxPoints: data.maxPoints,
      });
      setHasAnswered(false);
      setLastAnswerCorrect(null);
      setPhase('question');
    });

    newSocket.on('answer_result', (data) => {
      console.log('Answer result:', data);
      setHasAnswered(true);
      setLastAnswerCorrect(data.isCorrect);
      if (data.points > 0) {
        setScore(data.points); // Note: This is incremental, not total - we should track total separately
      }
    });

    newSocket.on('leaderboard_update', (data) => {
      console.log('Leaderboard update:', data);
      setLeaderboard(data.leaderboard);
      setPhase('leaderboard');
    });

    newSocket.on('game_ended', () => {
      console.log('Game ended');
      setPhase('lobby');
    });

    // Host events
    newSocket.on('session_created', (data) => {
      console.log('Session created:', data);
    });

    newSocket.on('player_joined', (data) => {
      console.log('Player joined:', data);
      addPlayer(data);
    });

    newSocket.on('player_left', (data) => {
      console.log('Player left:', data);
      removePlayer(data);
    });

    newSocket.on('answer_received', (data) => {
      console.log('Answer received from player:', data);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [setSocket, setConnected, setPhase, setCurrentQuestion, setLeaderboard, addPlayer, removePlayer, setScore, setHasAnswered, setLastAnswerCorrect]);

  return (
    <BrowserRouter>
      <div className="min-h-screen font-sans text-gray-900 flex flex-col">
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/player" element={<PlayerView />} />
          <Route path="/host" element={<HostDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
