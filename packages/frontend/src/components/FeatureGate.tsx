import React from 'react';

interface FeatureGateProps {
  feature: 'accuracy_mode' | 'image_questions' | 'session_history' | 'per_question_analytics' | 'team_orgs';
  tier: string | undefined;
  children: React.ReactNode;
}

const FEATURE_TIERS: Record<string, string[]> = {
  accuracy_mode: ['starter', 'pro', 'business'],
  image_questions: ['pro', 'business'],
  session_history: ['starter', 'pro', 'business'],
  per_question_analytics: ['pro', 'business'],
  team_orgs: ['business'],
};

export const FeatureGate = ({ feature, tier, children }: FeatureGateProps) => {
  const allowed = tier ? FEATURE_TIERS[feature]?.includes(tier.toLowerCase()) : false;
  if (allowed) return <>{children}</>;
  return (
    <div className="relative">
      <div className="opacity-30 pointer-events-none select-none">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-sm font-semibold">
          🔒 Upgrade to unlock
        </div>
      </div>
    </div>
  );
};
