import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type PaymentRequestType = 'payg_topup' | 'starter' | 'pro' | 'business';
export type PaymentRequestStatus = 'pending' | 'confirmed' | 'rejected';

@Entity()
export class PaymentRequest {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'enum', enum: ['payg_topup', 'starter', 'pro', 'business'] })
  requestType: PaymentRequestType;

  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'int' })
  creditsToAdd: number;

  @Column({ type: 'text', nullable: true })
  ownerReference: string | null;

  @Column({ type: 'text', nullable: true })
  proofFileUrl: string | null;

  @Column({ type: 'enum', enum: ['pending', 'confirmed', 'rejected'], default: 'pending' })
  status: PaymentRequestStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  reviewedBy: User | null;

  @Column({ type: 'text', nullable: true })
  adminNote: string | null;

  @CreateDateColumn() submittedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
}
