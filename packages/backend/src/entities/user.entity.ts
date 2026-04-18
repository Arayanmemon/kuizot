import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Organization } from './organization.entity';
import { Quiz } from './quiz.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  passwordHash: string; // If using local auth later

  @OneToMany(() => Organization, (organization) => organization.owner)
  organizations: Organization[];

  @OneToMany(() => Quiz, (quiz) => quiz.creator)
  quizzes: Quiz[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
