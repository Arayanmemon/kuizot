import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { FeatureGate } from '../components/FeatureGate';
import { useBilling } from '../hooks/useBilling';
import { QuestionMedia } from '../components/QuestionMedia';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface AnswerOption {
  id: string;
  text: string;
  color: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  text: string;
  timeLimit: number;
  scoringMode: 'classic' | 'accuracy';
  order: number;
  imageUrl?: string | null;
  options: AnswerOption[];
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
}

const TIME_LIMIT_OPTIONS = [10, 20, 30, 60] as const;
const OPTION_COLORS = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];

/* ─── QuizEditor page ─────────────────────────────────────────────────────── */

export const QuizEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Drag state
  const dragIndex = useRef<number | null>(null);
  const billing = useBilling();

  /* Fetch quiz + questions on mount */
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [quizRes, questionsRes] = await Promise.all([
          api.get<Quiz>(`/quizzes/${id}`),
          api.get<Question[]>(`/quizzes/${id}/questions`),
        ]);
        setQuiz(quizRes.data);
        setQuestions(questionsRes.data);
      } catch (err) {
        console.error('Failed to load quiz', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  /* ── Drag-to-reorder handlers ── */

  const handleDragStart = (index: number) => {
    dragIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex.current === null || dragIndex.current === index) return;

    const reordered = [...questions];
    const [moved] = reordered.splice(dragIndex.current, 1);
    reordered.splice(index, 0, moved);
    dragIndex.current = index;
    setQuestions(reordered);
  };

  const handleDrop = async () => {
    // Persist the new order for all questions
    const promises = questions.map((q, idx) =>
      api.patch(`/questions/${q.id}/reorder`, { order: idx + 1 }).catch(console.error),
    );
    await Promise.all(promises);
    dragIndex.current = null;
  };

  /* ── Add question ── */

  const handleAddQuestion = async () => {
    if (!id) return;
    const newOrder = questions.length + 1;
    try {
      const { data } = await api.post<Question>(`/quizzes/${id}/questions`, {
        text: 'New question',
        timeLimit: 20,
        scoringMode: 'classic',
        order: newOrder,
      });
      // Add default options locally
      const withOptions: Question = {
        ...data,
        options: data.options ?? [],
      };
      setQuestions((prev) => [...prev, withOptions]);
      setExpandedId(data.id);
    } catch (err) {
      console.error('Failed to add question', err);
    }
  };

  /* ── Delete question ── */

  const handleDeleteQuestion = async (qId: string) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await api.delete(`/questions/${qId}`);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      if (expandedId === qId) setExpandedId(null);
    } catch (err) {
      console.error('Failed to delete question', err);
    }
  };

  /* ── Update local question after inline save ── */

  const handleQuestionSaved = (updated: Question) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
    setExpandedId(null);
  };

  /* ── Render ── */

  if (loading) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <p className="text-white text-xl animate-pulse">Loading quiz…</p>
      </div>
    );
  }

  return (
    <div className="gradient-bg min-h-screen p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-white/80 hover:text-white transition-colors text-sm font-semibold"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-black text-white tracking-tight flex-1 truncate">
            {quiz?.title ?? 'Quiz Editor'}
          </h1>
        </div>

        {/* Question list */}
        <div className="flex flex-col gap-3 mb-6">
          {questions.length === 0 && (
            <p className="text-white/60 italic text-center py-8">No questions yet. Add one below!</p>
          )}
          {questions.map((q, index) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden"
            >
              {/* Question row */}
              <div className="flex items-center gap-3 p-4">
                {/* Drag handle */}
                <span className="text-white/40 cursor-grab active:cursor-grabbing text-lg select-none">≡</span>

                {/* Question text */}
                <span className="flex-1 text-white font-medium truncate">{q.text}</span>

                {/* Time limit badge */}
                <span className="bg-white/20 text-white text-xs font-semibold rounded-full px-2.5 py-1 shrink-0">
                  {q.timeLimit}s
                </span>

                {/* Edit / Delete */}
                <button
                  onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                  className="bg-white/20 hover:bg-white/30 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  {expandedId === q.id ? 'Close' : 'Edit'}
                </button>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="bg-red-500/70 hover:bg-red-500 text-white text-sm font-semibold rounded-lg px-3 py-1.5 transition-colors"
                >
                  Delete
                </button>
              </div>

              {/* Inline editor (expanded) */}
              {expandedId === q.id && (
                <QuestionInlineEditor
                  quizId={id!}
                  question={q}
                  tier={billing?.tier}
                  onSaved={handleQuestionSaved}
                  onCancel={() => setExpandedId(null)}
                />
              )}
            </div>
          ))}
        </div>

        {/* Add question button */}
        <button
          onClick={handleAddQuestion}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-white/40 text-white/70 hover:border-white/70 hover:text-white transition-colors font-semibold text-lg"
        >
          + Add Question
        </button>
      </div>
    </div>
  );
};

/* ─── Inline question editor ─────────────────────────────────────────────── */

interface QuestionInlineEditorProps {
  quizId: string;
  question: Question;
  tier?: string;
  onSaved: (updated: Question) => void;
  onCancel: () => void;
}

const QuestionInlineEditor = ({ question, tier, onSaved, onCancel }: QuestionInlineEditorProps) => {
  const [text, setText] = useState(question.text);
  const [timeLimit, setTimeLimit] = useState<number>(question.timeLimit);
  const [scoringMode, setScoringMode] = useState<'classic' | 'accuracy'>(question.scoringMode);
  const [imageUrl, setImageUrl] = useState<string>(question.imageUrl ?? '');
  const [options, setOptions] = useState<AnswerOption[]>(
    question.options.length > 0
      ? question.options
      : OPTION_COLORS.slice(0, 2).map((color, i) => ({
          id: `new_${i}`,
          text: '',
          color,
          isCorrect: i === 0,
        })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleOptionChange = (idx: number, field: keyof AnswerOption, value: string | boolean) => {
    setOptions((prev) =>
      prev.map((opt, i) => {
        if (i !== idx) {
          // If toggling correct answer (radio behavior), deselect others
          if (field === 'isCorrect' && value === true) return { ...opt, isCorrect: false };
          return opt;
        }
        return { ...opt, [field]: value };
      }),
    );
  };

  const handleAddOption = async () => {
    if (options.length >= 4) return;
    const color = OPTION_COLORS[options.length] ?? '#9333ea';
    try {
      const { data } = await api.post<AnswerOption>(`/questions/${question.id}/options`, {
        text: '',
        color,
        isCorrect: false,
      });
      setOptions((prev) => [...prev, data]);
    } catch {
      // Fallback: add locally with temp id
      setOptions((prev) => [
        ...prev,
        { id: `temp_${Date.now()}`, text: '', color, isCorrect: false },
      ]);
    }
  };

  const handleDeleteOption = async (opt: AnswerOption, idx: number) => {
    if (options.length <= 2) return; // minimum 2 options
    if (!opt.id.startsWith('new_') && !opt.id.startsWith('temp_')) {
      try {
        await api.delete(`/options/${opt.id}`);
      } catch (err) {
        console.error('Failed to delete option', err);
        return;
      }
    }
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      // Save question fields
      const { data: savedQuestion } = await api.patch<Question>(`/questions/${question.id}`, {
        text,
        timeLimit,
        scoringMode,
        imageUrl: imageUrl || null,
      });

      // Save each option
      const savedOptions: AnswerOption[] = [];
      for (const opt of options) {
        if (opt.id.startsWith('new_') || opt.id.startsWith('temp_')) {
          // Create new option
          const { data } = await api.post<AnswerOption>(`/questions/${question.id}/options`, {
            text: opt.text,
            color: opt.color,
            isCorrect: opt.isCorrect,
          });
          savedOptions.push(data);
        } else {
          // Update existing option
          const { data } = await api.patch<AnswerOption>(`/options/${opt.id}`, {
            text: opt.text,
            color: opt.color,
            isCorrect: opt.isCorrect,
          });
          savedOptions.push(data);
        }
      }

      onSaved({ ...savedQuestion, options: savedOptions });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t border-white/20 p-5 flex flex-col gap-5">
      {/* Question text */}
      <div>
        <label className="block text-white/70 text-xs font-semibold mb-1 uppercase tracking-wide">Question Text</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-white/10 border border-white/30 rounded-xl p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/60"
          placeholder="Enter your question"
        />
      </div>

      {/* Media URL — images, GIFs, and YouTube links */}
      <FeatureGate feature="image_questions" tier={tier}>
        <div>
          <label className="block text-white/70 text-xs font-semibold mb-1 uppercase tracking-wide">
            Media URL — Image, GIF or YouTube link (optional)
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="w-full bg-white/10 border border-white/30 rounded-xl p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/60"
            placeholder="https://example.com/image.gif  or  https://youtube.com/watch?v=..."
          />
          {/* Live preview */}
          {imageUrl && (
            <div className="mt-2">
              <QuestionMedia url={imageUrl} className="max-h-48" />
            </div>
          )}
        </div>
      </FeatureGate>

      {/* Time limit + scoring row */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-36">
          <label className="block text-white/70 text-xs font-semibold mb-1 uppercase tracking-wide">Time Limit</label>
          <select
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="w-full bg-white/10 border border-white/30 rounded-xl p-3 text-white focus:outline-none focus:border-white/60"
          >
            {TIME_LIMIT_OPTIONS.map((t) => (
              <option key={t} value={t} className="bg-purple-900 text-white">
                {t}s
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-36">
          <label className="block text-white/70 text-xs font-semibold mb-1 uppercase tracking-wide">Scoring</label>
          <div className="flex rounded-xl overflow-hidden border border-white/30">
            {(['classic', 'accuracy'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setScoringMode(mode)}
                className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                  scoringMode === mode
                    ? 'bg-white text-purple-700'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Options */}
      <div>
        <label className="block text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">
          Answer Options
        </label>
        <div className="flex flex-col gap-2">
          {options.map((opt, idx) => (
            <div key={opt.id} className="flex items-center gap-2">
              {/* Color swatch */}
              <input
                type="color"
                value={opt.color}
                onChange={(e) => handleOptionChange(idx, 'color', e.target.value)}
                className="w-9 h-9 rounded-lg border-0 cursor-pointer bg-transparent"
                title="Option color"
              />
              {/* Text */}
              <input
                type="text"
                value={opt.text}
                onChange={(e) => handleOptionChange(idx, 'text', e.target.value)}
                placeholder={`Option ${idx + 1}`}
                className="flex-1 bg-white/10 border border-white/30 rounded-xl p-2.5 text-white placeholder-white/40 focus:outline-none focus:border-white/60 text-sm"
              />
              {/* Correct radio */}
              <label className="flex items-center gap-1.5 text-white/70 text-xs cursor-pointer shrink-0">
                <input
                  type="radio"
                  name={`correct_${question.id}`}
                  checked={opt.isCorrect}
                  onChange={() => handleOptionChange(idx, 'isCorrect', true)}
                  className="accent-green-400 w-4 h-4"
                />
                Correct
              </label>
              {/* Delete option */}
              {options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleDeleteOption(opt, idx)}
                  className="text-white/40 hover:text-red-400 transition-colors text-lg leading-none"
                  title="Remove option"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
        {options.length < 4 && (
          <button
            type="button"
            onClick={handleAddOption}
            className="mt-2 text-white/60 hover:text-white text-sm transition-colors"
          >
            + Add Option
          </button>
        )}
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Save / Cancel */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-white/30 text-white/70 font-semibold hover:bg-white/10 transition-colors text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl bg-white text-purple-700 font-bold hover:bg-white/90 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};
