import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './game.gateway';
import { PinService } from './services/pin.service';
import { SessionService } from './services/session.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ScoringService } from './services/scoring.service';
import { SessionHistoryService } from './services/session-history.service';
import { QuestionsModule } from '../questions/questions.module';
import { GameSession } from '../entities/game-session.entity';
import { Quiz } from '../entities/quiz.entity';
import { BillingModule } from '../billing/billing.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSession, Quiz]),
    QuestionsModule,
    BillingModule,
    forwardRef(() => AnalyticsModule),
  ],
  providers: [
    GameGateway,
    PinService,
    SessionService,
    LeaderboardService,
    ScoringService,
    SessionHistoryService,
  ],
  exports: [
    GameGateway,
    PinService,
    SessionService,
    LeaderboardService,
    ScoringService,
    SessionHistoryService,
  ],
})
export class GameModule {}
