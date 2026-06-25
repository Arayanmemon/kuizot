import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';

@Injectable()
export class BillingCronService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
  ) {}

  // Run at noon on the 1st day of every month
  @Cron('0 12 1 * *')
  async resetMonthlySessions(): Promise<void> {
    const now = new Date();
    const expiredMonthly = await this.subRepo.find({
      where: { billingModel: 'monthly' },
    });
    const toReset = expiredMonthly.filter(
      (s) => s.currentPeriodEnd !== null && s.currentPeriodEnd < now,
    );
    for (const sub of toReset) {
      sub.sessionsUsedThisPeriod = 0;
      sub.currentPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    if (toReset.length > 0) await this.subRepo.save(toReset);
  }
}
