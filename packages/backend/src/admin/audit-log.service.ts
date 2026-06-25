import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(
    action: string,
    actorId: string,
    targetType: string,
    targetId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry = this.repo.create({
      action,
      actorId,
      targetType,
      targetId,
      metadata: metadata ?? null,
    });
    await this.repo.save(entry);
  }
}
