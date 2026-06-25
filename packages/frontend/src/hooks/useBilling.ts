import { useState, useEffect } from 'react';
import api from '../lib/api';

export interface Subscription {
  tier: string;
  billingModel: string;
  creditBalance: number;
  sessionsUsedThisPeriod: number;
  currentPeriodEnd: string | null;
  status: string;
}

export const useBilling = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  useEffect(() => {
    api.get<Subscription>('/billing/me').then((r) => setSubscription(r.data)).catch(() => {});
  }, []);
  return subscription;
};
