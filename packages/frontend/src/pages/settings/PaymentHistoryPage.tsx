import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface PaymentRequest {
  id: string;
  requestType: string;
  amountCents: number;
  creditsToAdd: number;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  adminNote?: string;
}

const STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30',
  confirmed: 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30',
  rejected: 'bg-red-400/20 text-red-300 border border-red-400/30',
};

const formatType = (type: string): string => {
  const map: Record<string, string> = {
    payg_topup: 'Pay-as-you-go',
    starter: 'Starter Plan',
    pro: 'Pro Plan',
    business: 'Business Plan',
  };
  return map[type] ?? type;
};

export const PaymentHistoryPage = () => {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get<PaymentRequest[]>('/billing/payment-requests')
      .then((r) => setRequests(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="gradient-bg min-h-screen p-6">
      {/* Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-white tracking-tight">Payment History</h1>
        <button
          onClick={() => navigate('/settings/billing')}
          className="text-white/80 hover:text-white transition-colors text-sm font-semibold"
        >
          ← Back
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        {loading ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 animate-pulse">
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-white/20 rounded-xl" />
              ))}
            </div>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
            <p className="text-white/60 text-lg">No payment requests yet.</p>
            <button
              onClick={() => navigate('/settings/billing/topup')}
              className="mt-4 bg-white text-purple-700 font-bold py-2.5 px-6 rounded-xl hover:bg-white/90 transition-colors text-sm"
            >
              Make a Payment
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-white/20 text-white/60 text-xs font-semibold uppercase tracking-wide">
              <span>Date</span>
              <span>Type</span>
              <span>Amount</span>
              <span>Credits</span>
              <span>Status</span>
            </div>

            {/* Table rows */}
            <div className="divide-y divide-white/10">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="grid grid-cols-5 gap-4 px-6 py-4 items-center text-white text-sm"
                >
                  <span className="text-white/70 text-xs">
                    {new Date(req.createdAt).toLocaleDateString()}
                  </span>
                  <span className="font-medium">{formatType(req.requestType)}</span>
                  <span className="font-mono">${(req.amountCents / 100).toFixed(2)}</span>
                  <span>{req.creditsToAdd}</span>
                  <span>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        STATUS_CLASSES[req.status] ?? ''
                      }`}
                    >
                      {req.status}
                    </span>
                    {req.adminNote && req.status === 'rejected' && (
                      <p className="text-red-300/70 text-xs mt-1 truncate" title={req.adminNote}>
                        {req.adminNote}
                      </p>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
