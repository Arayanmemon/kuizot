import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuestionStat } from '../entities/question-stat.entity';
import { GameSession } from '../entities/game-session.entity';
import { Quiz } from '../entities/quiz.entity';
import { Subscription } from '../entities/subscription.entity';
import { RedisModule } from '../redis/redis.module';
import { QuizzesModule } from '../quizzes/quizzes.module';
import { SessionAnalyticsService } from './session-analytics.service';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController, AdminAnalyticsController } from './analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuestionStat, GameSession, Quiz, Subscription]),
    RedisModule,
    QuizzesModule,
  ],
  controllers: [AnalyticsController, AdminAnalyticsController],
  providers: [SessionAnalyticsService, AnalyticsService],
  exports: [SessionAnalyticsService, AnalyticsService],
})
export class AnalyticsModule {}
