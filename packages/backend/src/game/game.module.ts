import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway';
import { PinService } from './services/pin.service';
import { SessionService } from './services/session.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ScoringService } from './services/scoring.service';

@Module({
  providers: [GameGateway, PinService, SessionService, LeaderboardService, ScoringService],
  exports: [GameGateway, PinService, SessionService, LeaderboardService, ScoringService],
})
export class GameModule {}
