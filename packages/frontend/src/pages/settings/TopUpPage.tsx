import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';

interface BankDetails {
  accountName: string;
  accountNumber: string;
  sortCode: string;
  iban: string;
  referencePrefix: string;
}

type PlanType = 'payg' | 'starter' | 'pro' | 'business';

const PLAN_CONFIG = {
  payg: {
    label: 'Pay-as-you-go',
    description: 'Top up credits as needed — minimum $5',
    price: null,
    requestType: 'payg_topup',
  },
  starter: {
    label: 'Starter',
    description: '30 sessions / month, up to 30 players',
    price: 8,
    requestType: 'starter',
    creditsToAdd: 80,
  },
  pro: {
    label: 'Pro',
    description: '100 sessions / month, up to 100 players',
    price: 20,
    requestType: 'pro',
    creditsToAdd: 200,
  },
  business: {
    label: 'Business',
    description: '500 sessions / month, up to 500 players',
    price: 50,
    requestType: 'business',
    creditsToAdd: 500,
  },
} as const;

export const TopUpPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('payg');
  const [amount, setAmount] = useState<number>(5);
  const [reference, setReference] = useState<string>(`KZT-${user?.id ?? ''}`);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<BankDetails>('/billing/bank-details')
      .then((r) => setBankDetails(r.data))
      .catch(console.error);
  }, []);

  // Update reference when user changes
  useEffect(() => {
    if (user?.id) {
      setReference(`KZT-${user.id}`);
    }
  }, [user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const plan = PLAN_CONFIG[selectedPlan];
      const formData = new FormData();

      formData.append('requestType', plan.requestType);

      if (selectedPlan === 'payg') {
        formData.append('amountCents', String(amount * 100));
        formData.append('creditsToAdd', String(amount * 10));
      } else {
        formData.append('amountCents', String((plan.price ?? 0) * 100));
        formData.append('creditsToAdd', String(plan.creditsToAdd));
      }

      formData.append('ownerReference', reference);

      if (proofFile) {
        formData.append('proof', proofFile);
      }

      await api.post('/billing/payment-requests', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message ?? 'Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="gradient-bg min-h-screen p-6 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-10 text-center max-w-md w-full">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-white mb-3">Request Submitted!</h2>
          <p className="text-white/70 mb-6">Admin will review your payment within 24 hours.</p>
          <button
            onClick={() => navigate('/settings/billing')}
            className="bg-white text-purple-700 font-bold py-3 px-6 rounded-xl hover:bg-white/90 transition-colors"
          >
            Back to Billing
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gradient-bg min-h-screen p-6">
      {/* Header */}
      <div className="max-w-2xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">Add Credits / Upgrade</h1>
        <button
          onClick={() => navigate('/settings/billing')}
          className="text-white/80 hover:text-white transition-colors text-sm font-semibold"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-2xl mx-auto">
        <form
          onSubmit={handleSubmit}
          className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 flex flex-col gap-7 text-white"
        >
          {/* Plan selector */}
          <div>
            <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3">
              Select Plan
            </p>
            <div className="flex flex-col gap-3">
              {(Object.entries(PLAN_CONFIG) as [PlanType, typeof PLAN_CONFIG[PlanType]][]).map(
                ([key, plan]) => (
                  <label
                    key={key}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                      selectedPlan === key
                        ? 'border-white/60 bg-white/15'
                        : 'border-white/20 hover:border-white/40 bg-white/5'
                    }`}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={key}
                      checked={selectedPlan === key}
                      onChange={() => setSelectedPlan(key)}
                      className="mt-0.5 accent-white"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{plan.label}</span>
                        {plan.price !== null && (
                          <span className="text-white/70 text-sm">${plan.price}/month</span>
                        )}
                      </div>
                      <p className="text-white/60 text-xs mt-0.5">{plan.description}</p>
                    </div>
                  </label>
                )
              )}
            </div>
          </div>

          {/* Amount input (PAYG only) */}
          {selectedPlan === 'payg' && (
            <div>
              <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
                Amount (USD)
              </label>
              <input
                type="number"
                min={5}
                step={1}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-white/10 border border-white/30 rounded-xl p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/60"
                placeholder="Minimum $5"
                required
              />
              <p className="text-white/50 text-xs mt-1">
                You will receive {amount * 10} credits (10 per $1)
              </p>
            </div>
          )}

          {/* Bank details */}
          {bankDetails ? (
            <div>
              <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-3">
                Bank Transfer Details
              </p>
              <div className="bg-white/5 border border-white/20 rounded-xl p-4 flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Account Name</span>
                  <span className="font-semibold">{bankDetails.accountName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Account Number</span>
                  <span className="font-mono">{bankDetails.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Sort Code</span>
                  <span className="font-mono">{bankDetails.sortCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">IBAN</span>
                  <span className="font-mono text-xs break-all">{bankDetails.iban}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/20 rounded-xl p-4 text-white/50 text-sm text-center">
              Loading bank details…
            </div>
          )}

          {/* Reference input */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
              Payment Reference
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full bg-white/10 border border-white/30 rounded-xl p-3 text-white placeholder-white/40 focus:outline-none focus:border-white/60"
              placeholder="KZT-..."
              required
            />
            <p className="text-white/50 text-xs mt-1">
              Use this reference when making your bank transfer
            </p>
          </div>

          {/* Proof upload */}
          <div>
            <label className="block text-white/70 text-xs font-semibold uppercase tracking-wide mb-2">
              Proof of Payment (optional)
            </label>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              className="w-full text-white/70 text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-white/20 file:text-white file:font-semibold hover:file:bg-white/30 file:cursor-pointer cursor-pointer"
            />
          </div>

          {error && (
            <p className="text-red-300 text-sm bg-red-500/10 border border-red-400/30 rounded-xl p-3">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-white text-purple-700 font-bold hover:bg-white/90 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting…' : 'Submit Payment Request'}
          </button>
        </form>
      </div>
    </div>
  );
};
