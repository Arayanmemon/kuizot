import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useBilling } from '../hooks/useBilling';
import { FeatureGate } from '../components/FeatureGate';

const TIER_BADGE_CLASSES: Record<string, string> = {
  free: 'bg-gray-400/20 text-gray-200',
  starter: 'bg-blue-400/20 text-blue-200',
  pro: 'bg-purple-400/20 text-purple-200',
  business: 'bg-yellow-400/20 text-yellow-200',
};

interface Quiz {
  id: string;
  title: string;
  description?: string;
  playCount: number;
  isPublic: boolean;
  createdAt: string;
  questions?: { id: string }[];
}

interface CreateQuizForm {
  title: string;
  description: string;
}

export const OwnerDashboard = () => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateQuizForm>({ title: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const navigate = useNavigate();
  const billing = useBilling();

  const fetchQuizzes = async () => {
    try {
      const { data } = await api.get<Quiz[]>('/quizzes');
      setQuizzes(data);
    } catch (err) {
      console.error('Failed to fetch quizzes', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.post('/quizzes', { title: form.title.trim(), description: form.description.trim() });
      setShowModal(false);
      setForm({ title: '', description: '' });
      await fetchQuizzes();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setCreateError(e.response?.data?.message ?? 'Failed to create quiz.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="gradient-bg min-h-screen p-6">
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black text-white tracking-tight">Kuizot</h1>
          {billing && (
            <>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  TIER_BADGE_CLASSES[billing.tier?.toLowerCase() ?? 'free'] ?? TIER_BADGE_CLASSES['free']
                }`}
              >
                {billing.tier ?? 'FREE'}
              </span>
              <span className="text-white/70 text-sm">
                💳 {billing.creditBalance} credits
              </span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-white text-purple-700 font-bold text-sm rounded-xl px-5 py-2.5 hover:bg-white/90 transition-colors shadow-lg"
        >
          + Create Quiz
        </button>
      </div>

      {/* Quiz Grid */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          /* Skeleton loading state */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-white/20 rounded-lg mb-4 w-3/4" />
                <div className="h-4 bg-white/10 rounded-lg mb-6 w-1/2" />
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-8 bg-white/10 rounded-lg flex-1" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : quizzes.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24">
            <p className="text-white/70 text-xl mb-4">No quizzes yet. Create your first one!</p>
            <button
              onClick={() => setShowModal(true)}
              className="bg-white text-purple-700 font-bold rounded-xl px-6 py-3 hover:bg-white/90 transition-colors shadow-lg"
            >
              + Create Quiz
            </button>
          </div>
        ) : (
          /* Quiz cards grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                tier={billing?.tier}
                onHost={() => navigate(`/host?quizId=${quiz.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Quiz Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">New Quiz</h2>
            <form onSubmit={handleCreateQuiz} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="Quiz title"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={100}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
                <textarea
                  placeholder="Optional description"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={300}
                  rows={3}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-colors resize-none"
                />
              </div>
              {createError && (
                <p className="text-red-500 text-sm">{createError}</p>
              )}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setForm({ title: '', description: '' }); setCreateError(''); }}
                  className="flex-1 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !form.title.trim()}
                  className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

interface QuizCardProps {
  quiz: Quiz;
  tier?: string;
  onHost: () => void;
}

const QuizCard = ({ quiz, tier, onHost }: QuizCardProps) => {
  const questionCount = quiz.questions?.length ?? 0;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white flex flex-col gap-4">
      {/* Title */}
      <h2 className="text-xl font-bold leading-tight line-clamp-2">{quiz.title}</h2>

      {/* Badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="bg-white/20 text-white text-xs font-semibold rounded-full px-3 py-1">
          {quiz.playCount} plays
        </span>
        <span className="bg-white/20 text-white text-xs font-semibold rounded-full px-3 py-1">
          {questionCount} {questionCount === 1 ? 'question' : 'questions'}
        </span>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-4 gap-2 mt-auto">
        <Link
          to={`/dashboard/quizzes/${quiz.id}/edit`}
          className="flex items-center justify-center py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold text-center"
        >
          Edit
        </Link>
        <Link
          to={`/dashboard/quizzes/${quiz.id}/history`}
          className="flex items-center justify-center py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold text-center"
        >
          History
        </Link>
        <button
          onClick={onHost}
          className="py-2 rounded-xl bg-white text-purple-700 font-bold text-sm hover:bg-white/90 transition-colors"
        >
          Host
        </button>
        <Link
          to={`/dashboard/quizzes/${quiz.id}/analytics`}
          className="py-2 rounded-xl bg-white/20 hover:bg-white/30 transition-colors text-sm font-semibold flex items-center justify-center"
        >
          Stats
        </Link>
      </div>
    </div>
  );
};
