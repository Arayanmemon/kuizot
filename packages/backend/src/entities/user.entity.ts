import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne } from 'typeorm';
import { Organization } from './organization.entity';
import { Quiz } from './quiz.entity';
import { Subscription } from './subscription.entity';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ type: 'enum', enum: ['super_admin', 'admin', 'owner'], default: 'owner' })
  role: 'super_admin' | 'admin' | 'owner';

  @Column({ type: 'text', nullable: true, select: false })
  refreshToken: string | null;

  @Column({ default: false })
  suspended: boolean;

  @OneToMany(() => Organization, (organization) => organization.owner)
  organizations: Organization[];

  @OneToMany(() => Quiz, (quiz) => quiz.creator)
  quizzes: Quiz[];

  @OneToOne(() => Subscription, (sub) => sub.user)
  subscription: Subscription;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
