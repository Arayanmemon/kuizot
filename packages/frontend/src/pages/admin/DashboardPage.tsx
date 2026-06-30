import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import api from '../../lib/api';

interface AdminStats {
  userCount: number;
  quizCount: number;
  activeSessionCount: number;
  confirmedRevenue: number;
}

interface AdminAnalytics {
  dau: { date: string; count: number }[];
  mau: { month: string; count: number }[];
  tierCounts: { free: number; starter: number; pro: number; business: number };
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
}

const StatCard = ({ title, value, icon }: StatCardProps) => (
  <div className="bg-gray-800 rounded-xl p-5 text-white">
    <div className="flex items-center gap-3 mb-2">
      <span className="text-2xl">{icon}</span>
      <span className="text-sm font-medium text-gray-400">{title}</span>
    </div>
    <p className="text-3xl font-bold">{value}</p>
  </div>
);

const TIER_COLORS: Record<string, string> = {
  Free: '#6b7280',
  Starter: '#3b82f6',
  Pro: '#a855f7',
  Business: '#f59e0b',
};

const formatDauDate = (dateStr: string): string => {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const formatMauMonth = (monthStr: string): string => {
  try {
    return new Date(monthStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return monthStr;
  }
};

export const DashboardPage = () => {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await api.get<AdminStats>('/admin/stats');
      return res.data;
    },
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AdminAnalytics>({
    queryKey: ['admin', 'analytics'],
    queryFn: async () => {
      const res = await api.get<AdminAnalytics>('/admin/analytics');
      return res.data;
    },
  });

  const dauData = (analytics?.dau ?? []).map((d) => ({
    ...d,
    dateLabel: formatDauDate(d.date),
  }));

  const mauData = (analytics?.mau ?? []).map((m) => ({
    ...m,
    monthLabel: formatMauMonth(m.month),
  }));

  const tierData = analytics
    ? [
        { name: 'Free', value: analytics.tierCounts.free },
        { name: 'Starter', value: analytics.tierCounts.starter },
        { name: 'Pro', value: analytics.tierCounts.pro },
        { name: 'Business', value: analytics.tierCounts.business },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      {statsError && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          Failed to load stats. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={statsLoading ? '—' : (stats?.userCount ?? 0)}
          icon="👥"
        />
        <StatCard
          title="Total Quizzes"
          value={statsLoading ? '—' : (stats?.quizCount ?? 0)}
          icon="📝"
        />
        <StatCard
          title="Active Sessions"
          value={statsLoading ? '—' : (stats?.activeSessionCount ?? 0)}
          icon="🎮"
        />
        <StatCard
          title="Confirmed Revenue"
          value={statsLoading ? '—' : `$${((stats?.confirmedRevenue ?? 0) / 100).toFixed(2)}`}
          icon="💰"
        />
      </div>

      {/* DAU + Tier Distribution — 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* DAU LineChart — takes 2 columns */}
        <div className="xl:col-span-2 bg-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Daily Active Sessions (Last 30 Days)</h2>
          {analyticsLoading ? (
            <div className="h-[260px] flex items-center justify-center">
              <span className="text-gray-500 text-sm">Loading…</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={dauData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(dauData.length / 6) - 1)}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f9fafb' }}
                  itemStyle={{ color: '#a5b4fc' }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Sessions"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tier Distribution PieChart */}
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Subscription Tier Distribution</h2>
          {analyticsLoading ? (
            <div className="h-[260px] flex items-center justify-center">
              <span className="text-gray-500 text-sm">Loading…</span>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={tierData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={80}
                >
                  {tierData.map((entry) => (
                    <Cell key={entry.name} fill={TIER_COLORS[entry.name] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  labelStyle={{ color: '#f9fafb' }}
                  itemStyle={{ color: '#f9fafb' }}
                />
                <Legend
                  wrapperStyle={{ color: '#9ca3af', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* MAU BarChart — full width */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">Monthly Active Sessions (Last 6 Months)</h2>
        {analyticsLoading ? (
          <div className="h-[200px] flex items-center justify-center">
            <span className="text-gray-500 text-sm">Loading…</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={mauData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="monthLabel"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={{ stroke: '#374151' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#f9fafb' }}
                itemStyle={{ color: '#a5b4fc' }}
              />
              <Bar
                dataKey="count"
                name="Sessions"
                fill="#6366f1"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
