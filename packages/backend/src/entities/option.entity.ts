import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Question } from './question.entity';

@Entity()
export class Option {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  text: string;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'varchar', length: 7 }) // e.g., hex color #ff0000
  color: string;

  @ManyToOne(() => Question, (question) => question.options, { onDelete: 'CASCADE' })
  question: Question;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
