// TODO (Phase 4): Replace mock data with real tier distribution from GET /billing/subscriptions/stats
// once the billing module is implemented.

import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';

const TIER_DATA = [
  { name: 'free', value: 70 },
  { name: 'starter', value: 15 },
  { name: 'pro', value: 10 },
  { name: 'business', value: 5 },
];

const TIER_COLORS: Record<string, string> = {
  free: '#6b7280',
  starter: '#6366f1',
  pro: '#8b5cf6',
  business: '#ec4899',
};

export const SubscriptionsPage = () => {
  return (
    <div className="bg-gray-900 min-h-full space-y-6">
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Subscription Tier Distribution</h2>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={TIER_DATA}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ name, value }: { name: string; value: number }) =>
                `${name} (${value}%)`
              }
            >
              {TIER_DATA.map((entry) => (
                <Cell key={entry.name} fill={TIER_COLORS[entry.name] ?? '#6b7280'} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: 8,
              }}
              formatter={(value: number) => [`${value}%`, 'Share']}
            />
            <Legend
              formatter={(value: string) => (
                <span style={{ color: '#d1d5db', fontSize: 13 }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
