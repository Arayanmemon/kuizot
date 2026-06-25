import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Subscription, SubscriptionTier } from '../entities/subscription.entity';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
}

const FEATURE_MATRIX: Record<string, SubscriptionTier[]> = {
  accuracy_mode: ['starter', 'pro', 'business'],
  image_questions: ['pro', 'business'],
  session_history: ['starter', 'pro', 'business'],
  per_question_analytics: ['pro', 'business'],
  team_orgs: ['business'],
};

const TIER_SESSION_QUOTA: Record<SubscriptionTier, number> = {
  free: 2,
  starter: 30,
  pro: 100,
  business: 500,
};

const TIER_PLAYER_CAP: Record<SubscriptionTier, number> = {
  free: 10,
  starter: 30,
  pro: 100,
  business: 500,
};

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    private readonly configService: ConfigService,
  ) {}

  async checkLimit(
    userId: string,
    limit: 'session_start' | 'player_join',
  ): Promise<LimitCheckResult> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });

    // NOTE: If no subscription is found (e.g. anonymous/unauthenticated host),
    // we allow the action gracefully. This will be tightened once WebSocket auth is added.
    if (!sub) return { allowed: true };

    const cost =
      limit === 'session_start'
        ? this.configService.get<number>('CREDIT_COST_SESSION_START', 5)
        : this.configService.get<number>('CREDIT_COST_PER_PLAYER', 1);

    // Monthly billing: check quota first
    if (
      sub.billingModel === 'monthly' &&
      sub.currentPeriodEnd &&
      sub.currentPeriodEnd > new Date()
    ) {
      const quota =
        limit === 'session_start'
          ? TIER_SESSION_QUOTA[sub.tier]
          : TIER_PLAYER_CAP[sub.tier];
      if (sub.sessionsUsedThisPeriod < quota) return { allowed: true };
    }

    // Fall back to credit check
    if (sub.creditBalance >= cost) return { allowed: true };

    return {
      allowed: false,
      reason:
        limit === 'session_start'
          ? 'Insufficient credits'
          : 'Player limit reached',
    };
  }

  async checkFeature(userId: string, feature: string): Promise<boolean> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    if (!sub) return false;
    const allowedTiers = FEATURE_MATRIX[feature];
    if (!allowedTiers) return true; // Unknown features are allowed
    return allowedTiers.includes(sub.tier);
  }

  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.subRepo.findOne({ where: { user: { id: userId } } });
  }
}
