import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Quiz } from '../entities/quiz.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { GameSession } from '../entities/game-session.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLogService } from './audit-log.service';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Quiz, AuditLog, GameSession]),
    BillingModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AuditLogService, AuditLogInterceptor],
  exports: [AuditLogService],
})
export class AdminModule {}
