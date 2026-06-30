import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api from '../lib/api';
import { useBilling } from '../hooks/useBilling';

interface LeaderboardEntry {
  userId: string;
  nickname?: string;
  score: number;
}

interface Session {
  id: string;
  pin: string;
  playedAt: string;
  playerCount: number;
  leaderboardSnapshot: LeaderboardEntry[];
}

interface QuestionStat {
  questionId: string;
  questionText: string;
  correctPercent: number;
  avgTimeTakenMs: number;
  totalAnswers: number;
  sessionId: string;
}

interface QuizAnalyticsResponse {
  sessions: Session[];
  questionStats: QuestionStat[];
}

interface Quiz {
  id: string;
  title: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: QuestionStat }>;
  label?: string;
}

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const stat = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-sm max-w-xs">
        <p className="text-white font-semibold mb-1 break-words">{stat.questionText}</p>
        <p className="text-purple-400">{stat.correctPercent.toFixed(1)}% correct</p>
        <p className="text-gray-400">{stat.totalAnswers} answers</p>
      </div>
    );
  }
  return null;
};

export const OwnerAnalyticsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [analytics, setAnalytics] = useState<QuizAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const billing = useBilling();
  const canSeeQuestionChart = billing ? ['pro', 'business'].includes(billing.tier?.toLowerCase() ?? '') : false;

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [quizRes, analyticsRes] = await Promise.all([
          api.get<Quiz>(`/quizzes/${id}`),
          api.get<QuizAnalyticsResponse>(`/analytics/quiz/${id}`),
        ]);
        setQuiz(quizRes.data);
        setAnalytics(analyticsRes.data);
      } catch (err: unknown) {
        const e = err as { response?: { status?: number; data?: { message?: string } } };
        if (e.response?.status === 403) {
          setError('You do not have access to this quiz.');
        } else if (e.response?.status === 404) {
          setError('Quiz not found.');
        } else {
          setError('Failed to load analytics. Please try again.');
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

  const getTopScorer = (session: Session): string => {
    if (!session.leaderboardSnapshot || session.leaderboardSnapshot.length === 0) return '—';
    const top = session.leaderboardSnapshot[0];
    return top.nickname ?? top.userId ?? '—';
  };

  const truncate = (text: string, maxLen = 20): string => {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  };

  // Deduplicate questionStats by questionId — take the first occurrence
  const uniqueQuestionStats: QuestionStat[] = analytics
    ? Array.from(
        new Map(analytics.questionStats.map((s) => [s.questionId, s])).values()
      )
    : [];

  const chartData = uniqueQuestionStats.map((s) => ({
    ...s,
    label: truncate(s.questionText),
  }));

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
            Analytics — {quiz?.title ?? '…'}
          </h1>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 animate-pulse">
              <div className="h-6 bg-white/20 rounded-lg mb-4 w-1/3" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-white/10 rounded-lg mb-3" />
              ))}
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 animate-pulse">
              <div className="h-6 bg-white/20 rounded-lg mb-4 w-1/2" />
              <div className="h-64 bg-white/10 rounded-lg" />
            </div>
          </div>
        ) : error ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-red-300 text-lg">{error}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sessions table */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/20">
                <h2 className="text-white font-bold text-lg">Sessions</h2>
              </div>
              {!analytics || analytics.sessions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-white/60 text-sm">
                    No sessions yet — host a game to see session data.
                  </p>
                </div>
              ) : (
                <table className="w-full text-white">
                  <thead>
                    <tr className="border-b border-white/20">
                      <th className="text-left p-4 text-white/70 font-semibold text-sm uppercase tracking-wide">
                        Date
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
                    {analytics.sessions.map((session, idx) => (
                      <tr
                        key={session.id}
                        className={`border-b border-white/10 ${idx % 2 === 0 ? 'bg-white/5' : ''}`}
                      >
                        <td className="p-4 text-sm">
                          <Link
                            to={`/dashboard/quizzes/${id}/history`}
                            className="hover:text-purple-300 transition-colors"
                          >
                            {formatDate(session.playedAt)}
                          </Link>
                        </td>
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
              )}
            </div>

            {/* Per-question correctness bar chart */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold text-lg">Question Correctness (%)</h2>
                {!canSeeQuestionChart && billing && (
                  <span className="text-xs bg-purple-500/30 text-purple-200 border border-purple-400/40 rounded-full px-3 py-1 font-semibold">
                    Pro feature
                  </span>
                )}
              </div>
              {!canSeeQuestionChart ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <span className="text-3xl">🔒</span>
                  <p className="text-white/70 text-sm text-center">
                    Per-question analytics requires a <strong>Pro</strong> or <strong>Business</strong> plan.
                  </p>
                  <Link
                    to="/settings/billing/topup"
                    className="bg-white text-purple-700 font-bold text-sm rounded-xl px-5 py-2 hover:bg-white/90 transition-colors"
                  >
                    Upgrade Now
                  </Link>
                </div>
              ) : chartData.length === 0 ? (
                <div className="flex items-center justify-center h-40">
                  <p className="text-white/60 text-sm text-center">
                    No question data yet — play a game to see analytics
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 16, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#d1d5db', fontSize: 11 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#d1d5db', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="correctPercent"
                      fill="#a855f7"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
