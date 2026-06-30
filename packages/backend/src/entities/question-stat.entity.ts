import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { GameSession } from './game-session.entity';
import { Question } from './question.entity';

@Entity()
export class QuestionStat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => GameSession, { onDelete: 'CASCADE' }) gameSession: GameSession;
  @ManyToOne(() => Question, { onDelete: 'CASCADE' }) question: Question;
  @Column({ type: 'int' }) correctCount: number;
  @Column({ type: 'int' }) totalAnswers: number;
  @Column({ type: 'int' }) avgTimeTakenMs: number;
  @CreateDateColumn() createdAt: Date;
}
