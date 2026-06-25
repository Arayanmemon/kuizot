import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Subscription } from '../../entities/subscription.entity';
import { CreditTransaction, CreditTransactionType } from '../../entities/credit-transaction.entity';

@Injectable()
export class CreditsService {
  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(CreditTransaction)
    private txRepo: Repository<CreditTransaction>,
    private dataSource: DataSource,
  ) {}

  async addCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    referenceId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sub = await manager.findOne(Subscription, {
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sub) throw new NotFoundException('Subscription not found');
      sub.creditBalance += amount;
      await manager.save(sub);
      await manager.save(
        manager.create(CreditTransaction, {
          user: { id: userId },
          delta: amount,
          balanceAfter: sub.creditBalance,
          type,
          referenceId: referenceId ?? null,
          note: null,
        }),
      );
    });
  }

  async deductCredits(
    userId: string,
    amount: number,
    type: CreditTransactionType,
    referenceId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sub = await manager.findOne(Subscription, {
        where: { user: { id: userId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!sub) throw new NotFoundException('Subscription not found');
      if (sub.creditBalance < amount)
        throw new BadRequestException('Insufficient credits');
      sub.creditBalance -= amount;
      await manager.save(sub);
      await manager.save(
        manager.create(CreditTransaction, {
          user: { id: userId },
          delta: -amount,
          balanceAfter: sub.creditBalance,
          type,
          referenceId: referenceId ?? null,
          note: null,
        }),
      );
    });
  }

  async getBalance(userId: string): Promise<number> {
    const sub = await this.subRepo.findOne({ where: { user: { id: userId } } });
    return sub?.creditBalance ?? 0;
  }

  async getTransactions(userId: string): Promise<CreditTransaction[]> {
    return this.txRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }
}
