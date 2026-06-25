import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string; // e.g. 'UPDATE_USER_ROLE', 'DELETE_QUIZ'

  @Column('uuid')
  actorId: string;

  @Column()
  targetType: string; // e.g. 'User', 'Quiz'

  @Column('uuid')
  targetId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
