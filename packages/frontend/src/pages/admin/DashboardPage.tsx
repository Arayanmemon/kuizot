import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
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

// Mock signup data for the last 7 days.
// TODO (Phase 5): Replace with real data from GET /admin/analytics once the analytics endpoint is available.
const generateMockSignupData = () => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map((day) => ({
    day,
    signups: Math.floor(Math.random() * 30) + 5,
  }));
};

const MOCK_SIGNUP_DATA = generateMockSignupData();

export const DashboardPage = () => {
  const { data: stats, isLoading, isError } = useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await api.get<AdminStats>('/admin/stats');
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      {isError && (
        <div className="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-300 text-sm">
          Failed to load stats. Please try again.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={isLoading ? '—' : (stats?.userCount ?? 0)}
          icon="👥"
        />
        <StatCard
          title="Total Quizzes"
          value={isLoading ? '—' : (stats?.quizCount ?? 0)}
          icon="📝"
        />
        <StatCard
          title="Active Sessions"
          value={isLoading ? '—' : (stats?.activeSessionCount ?? 0)}
          icon="🎮"
        />
        <StatCard
          title="Confirmed Revenue"
          value={isLoading ? '—' : `$${((stats?.confirmedRevenue ?? 0) / 100).toFixed(2)}`}
          icon="💰"
        />
      </div>

      {/* User Signups Chart */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-white font-semibold mb-4">User Signups Over Time</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={MOCK_SIGNUP_DATA} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="day"
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
            <Line
              type="monotone"
              dataKey="signups"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
