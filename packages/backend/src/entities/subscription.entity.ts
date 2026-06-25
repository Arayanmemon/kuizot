import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export type BillingModel = 'payg' | 'monthly';
export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'business';
export type SubscriptionStatus = 'active' | 'suspended' | 'expired';

@Entity()
export class Subscription {
  @PrimaryGeneratedColumn('uuid') id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'enum', enum: ['payg', 'monthly'], default: 'payg' })
  billingModel: BillingModel;

  @Column({ type: 'enum', enum: ['free', 'starter', 'pro', 'business'], default: 'free' })
  tier: SubscriptionTier;

  @Column({ type: 'int', default: 0 })
  creditBalance: number;

  @Column({ type: 'timestamptz', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({ type: 'int', default: 0 })
  sessionsUsedThisPeriod: number;

  @Column({ type: 'enum', enum: ['active', 'suspended', 'expired'], default: 'active' })
  status: SubscriptionStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
