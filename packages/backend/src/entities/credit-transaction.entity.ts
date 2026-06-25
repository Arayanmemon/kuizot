import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { User } from './user.entity';

export type CreditTransactionType =
  | 'payment'
  | 'session_start'
  | 'player_join'
  | 'admin_adjustment'
  | 'refund';

@Entity()
export class CreditTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  /** Positive = credit added, negative = deducted */
  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'int' })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: ['payment', 'session_start', 'player_join', 'admin_adjustment', 'refund'],
  })
  type: CreditTransactionType;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn() createdAt: Date;
}
