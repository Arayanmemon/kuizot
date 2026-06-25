import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useGameStore } from './store/gameStore';

import { JoinPage } from './pages/JoinPage';
import { PlayerView } from './pages/PlayerView';
import { HostDashboard } from './pages/HostDashboard';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PrivateRoute } from './components/PrivateRoute';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { QuizEditor } from './pages/QuizEditor';
import { SessionHistoryPage } from './pages/SessionHistoryPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { UsersPage } from './pages/admin/UsersPage';
import { QuizzesPage as AdminQuizzesPage } from './pages/admin/QuizzesPage';
import { OrganizationsPage } from './pages/admin/OrganizationsPage';
import { SubscriptionsPage } from './pages/admin/SubscriptionsPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { PaymentRequestsPage } from './pages/admin/PaymentRequestsPage';
import { BillingPage } from './pages/settings/BillingPage';
import { TopUpPage } from './pages/settings/TopUpPage';
import { PaymentHistoryPage } from './pages/settings/PaymentHistoryPage';

function AppInner() {
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
    resetStore,
  } = useGameStore();

  const navigate = useNavigate();

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
        setScore(data.points);
      }
    });

    newSocket.on('leaderboard_update', (data) => {
      console.log('Leaderboard update:', data);
      setLeaderboard(data.leaderboard);
      setPhase('leaderboard');
    });

    newSocket.on('game_ended', () => {
      console.log('Game ended');
      // Players get sent back to the join page and their game state is cleared.
      // The host handles their own navigation via the "Back to Lobby" button.
      const currentRole = useGameStore.getState().role;
      if (currentRole === 'player') {
        resetStore();
        navigate('/');
      }
      // Host stays — their HostDashboard already called setPhase('lobby') in endGame()
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<JoinPage />} />
      <Route path="/player" element={<PlayerView />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes — owner, admin, super_admin */}
      <Route element={<PrivateRoute allowedRoles={['owner', 'admin', 'super_admin']} />}>
        <Route path="/host" element={<HostDashboard />} />
        <Route path="/dashboard" element={<OwnerDashboard />} />
        <Route path="/dashboard/quizzes/:id/edit" element={<QuizEditor />} />
        <Route path="/dashboard/quizzes/:id/history" element={<SessionHistoryPage />} />
        <Route path="/settings/billing" element={<BillingPage />} />
        <Route path="/settings/billing/topup" element={<TopUpPage />} />
        <Route path="/settings/billing/history" element={<PaymentHistoryPage />} />
      </Route>

      {/* Protected routes — admin, super_admin */}
      <Route element={<PrivateRoute allowedRoles={['super_admin', 'admin']} />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
          <Route path="/admin/quizzes" element={<AdminQuizzesPage />} />
          <Route path="/admin/orgs" element={<OrganizationsPage />} />
          <Route path="/admin/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/admin/payments" element={<PaymentRequestsPage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen font-sans text-gray-900 flex flex-col">
        <AppInner />
      </div>
    </BrowserRouter>
  );
}

export default App;
