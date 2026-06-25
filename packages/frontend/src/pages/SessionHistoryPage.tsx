import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

interface LeaderboardEntry {
  userId: string;
  nickname?: string;
  score: number;
}

interface GameSession {
  id: string;
  pin: string;
  playerCount: number;
  leaderboardSnapshot: LeaderboardEntry[];
  playedAt: string;
}

interface Quiz {
  id: string;
  title: string;
}

export const SessionHistoryPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [quizRes, sessionsRes] = await Promise.all([
          api.get<Quiz>(`/quizzes/${id}`),
          api.get<GameSession[]>(`/quizzes/${id}/sessions`),
        ]);
        setQuiz(quizRes.data);
        setSessions(sessionsRes.data);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number } };
        if (e.response?.status === 404) {
          // Sessions endpoint not yet populated — show empty state
          setSessions([]);
        } else {
          setError('Failed to load session history.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const formatDate = (isoString: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(isoString));
    } catch {
      return isoString;
    }
  };

  const getTopScorer = (session: GameSession): string => {
    if (!session.leaderboardSnapshot || session.leaderboardSnapshot.length === 0) return '—';
    const top = session.leaderboardSnapshot[0];
    return top.nickname ?? top.userId ?? '—';
  };

  return (
    <div className="gradient-bg min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white/80 hover:text-white transition-colors text-sm font-semibold shrink-0"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-black text-white tracking-tight truncate">
            Session History — {quiz?.title ?? '…'}
          </h1>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 animate-pulse">
            <div className="h-6 bg-white/20 rounded-lg mb-4 w-1/3" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-white/10 rounded-lg mb-3" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-red-300 text-lg">{error}</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
            <p className="text-white/70 text-xl">No sessions yet.</p>
            <p className="text-white/50 text-sm mt-2">
              Host this quiz to start recording session history.
            </p>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
            <table className="w-full text-white">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left p-4 text-white/70 font-semibold text-sm uppercase tracking-wide">
                    Date Played
                  </th>
                  <th className="text-left p-4 text-white/70 font-semibold text-sm uppercase tracking-wide">
                    PIN
                  </th>
                  <th className="text-left p-4 text-white/70 font-semibold text-sm uppercase tracking-wide">
                    Players
                  </th>
                  <th className="text-left p-4 text-white/70 font-semibold text-sm uppercase tracking-wide">
                    Top Scorer
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session, idx) => (
                  <tr
                    key={session.id}
                    className={`border-b border-white/10 ${idx % 2 === 0 ? 'bg-white/5' : ''}`}
                  >
                    <td className="p-4 text-sm">{formatDate(session.playedAt)}</td>
                    <td className="p-4">
                      <span className="bg-white/20 rounded-lg px-2.5 py-1 text-sm font-mono font-bold tracking-widest">
                        {session.pin}
                      </span>
                    </td>
                    <td className="p-4 text-sm">{session.playerCount}</td>
                    <td className="p-4 text-sm font-medium">{getTopScorer(session)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
