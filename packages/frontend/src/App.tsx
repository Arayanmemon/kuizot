import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useGameStore } from './store/gameStore';

import { JoinPage } from './pages/JoinPage';
import { PlayerView } from './pages/PlayerView';
import { HostDashboard } from './pages/HostDashboard';

function App() {
  const { setSocket, socket } = useGameStore();

  useEffect(() => {
    // Connect to the backend /game namespace
    const newSocket = io('http://localhost:3000/game', {
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to GameServer with ID:', newSocket.id);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from GameServer');
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, [setSocket]);

  return (
    <BrowserRouter>
      <div className="min-h-screen font-sans text-gray-900 bg-gray-100 flex flex-col">
        {/* Connection Status Banner (Dev Only) */}
        {!socket?.connected && (
          <div className="bg-red-500 text-white text-center text-sm py-1">
            Connecting to Server...
          </div>
        )}

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
