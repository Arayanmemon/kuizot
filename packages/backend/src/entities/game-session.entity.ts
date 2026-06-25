import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Quiz } from './quiz.entity';
import { User } from './user.entity';
import { LeaderboardEntry } from '../game/services/leaderboard.service';

@Entity()
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  pin: string;

  @ManyToOne(() => Quiz)
  quiz: Quiz;

  @ManyToOne(() => User)
  host: User;

  @Column({ type: 'int' })
  playerCount: number;

  @Column({ type: 'jsonb' })
  leaderboardSnapshot: LeaderboardEntry[];

  @CreateDateColumn()
  playedAt: Date;
}
