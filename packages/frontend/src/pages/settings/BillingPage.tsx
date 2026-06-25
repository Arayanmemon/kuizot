import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface BillingInfo {
  tier: string;
  billingModel: string;
  creditBalance: number;
  sessionsUsedThisPeriod: number;
  currentPeriodEnd: string | null;
  status: string;
}

const TIER_QUOTAS: Record<string, number> = {
  free: 2,
  starter: 30,
  pro: 100,
  business: 500,
};

const TIER_BADGE_CLASSES: Record<string, string> = {
  free: 'bg-gray-400/20 text-gray-200 border border-gray-400/30',
  starter: 'bg-blue-400/20 text-blue-200 border border-blue-400/30',
  pro: 'bg-purple-400/20 text-purple-200 border border-purple-400/30',
  business: 'bg-yellow-400/20 text-yellow-200 border border-yellow-400/30',
};

export const BillingPage = () => {
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<BillingInfo>('/billing/me')
      .then((r) => setBilling(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const tierKey = billing?.tier?.toLowerCase() ?? 'free';
  const quota = TIER_QUOTAS[tierKey] ?? 2;
  const sessionsUsed = billing?.sessionsUsedThisPeriod ?? 0;
  const sessionProgress = Math.min((sessionsUsed / quota) * 100, 100);
  const creditProgress = Math.min(billing?.creditBalance ?? 0, 100);
  const badgeClass = TIER_BADGE_CLASSES[tierKey] ?? TIER_BADGE_CLASSES['free'];

  return (
    <div className="gradient-bg min-h-screen p-6">
      {/* Header */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-4xl font-black text-white tracking-tight">Kuizot</h1>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-white/80 hover:text-white transition-colors text-sm font-semibold"
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Main glass card */}
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 animate-pulse">
            <div className="h-6 bg-white/20 rounded-lg mb-6 w-1/3" />
            <div className="h-4 bg-white/10 rounded-lg mb-4 w-1/2" />
            <div className="h-4 bg-white/10 rounded-lg mb-4 w-2/3" />
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-white flex flex-col gap-8">
            {/* Tier badge row */}
            <div className="flex items-center gap-4 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wider ${badgeClass}`}>
                {billing?.tier ?? 'FREE'}
              </span>
              <span className="text-white/70 text-sm capitalize">
                {billing?.billingModel === 'monthly' ? 'Monthly subscription' : 'Pay-as-you-go'}
              </span>
              {billing?.status && billing.status !== 'active' && (
                <span className="text-red-300 text-xs font-semibold uppercase">{billing.status}</span>
              )}
            </div>

            {/* Credit balance */}
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                Credit Balance
              </p>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-5xl font-black">{billing?.creditBalance ?? 0}</span>
                <span className="text-white/60 text-lg mb-1">credits</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div
                  className="bg-white/70 rounded-full h-2.5 transition-all duration-500"
                  style={{ width: `${creditProgress}%` }}
                />
              </div>
            </div>

            {/* Sessions used */}
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                Sessions This Period
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl font-bold">{sessionsUsed}</span>
                <span className="text-white/60">/ {quota}</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2.5">
                <div
                  className="bg-white/60 rounded-full h-2.5 transition-all duration-500"
                  style={{ width: `${sessionProgress}%` }}
                />
              </div>
              {billing?.currentPeriodEnd && (
                <p className="text-white/50 text-xs mt-2">
                  Resets {new Date(billing.currentPeriodEnd).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => navigate('/settings/billing/topup')}
                className="flex-1 py-3 rounded-xl bg-white text-purple-700 font-bold hover:bg-white/90 transition-colors shadow-lg text-sm"
              >
                Add Credits / Upgrade
              </button>
              <Link
                to="/settings/billing/history"
                className="flex-1 py-3 rounded-xl border border-white/30 text-white font-semibold hover:bg-white/10 transition-colors text-sm text-center"
              >
                View Payment History
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
