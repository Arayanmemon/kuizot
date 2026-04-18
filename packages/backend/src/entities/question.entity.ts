import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { Quiz } from './quiz.entity';
import { Option } from './option.entity';

@Entity()
export class Question {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  text: string;

  @Column({ type: 'int', default: 20 }) // Default 20 seconds for a question
  timeLimit: number;

  @Column({ type: 'int', default: 1000 }) // Default 1000 points
  points: number;

  @Column({ type: 'enum', enum: ['classic', 'accuracy'], default: 'classic' })
  scoringMode: 'classic' | 'accuracy';

  @ManyToOne(() => Quiz, (quiz) => quiz.questions, { onDelete: 'CASCADE' })
  quiz: Quiz;

  @OneToMany(() => Option, (option) => option.question, { cascade: true })
  options: Option[];

  @Column({ type: 'int' })
  order: number; // Order of the question in the quiz

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
