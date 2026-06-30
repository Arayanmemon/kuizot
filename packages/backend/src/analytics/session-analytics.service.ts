import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuestionStat } from '../entities/question-stat.entity';
import { GameSession } from '../entities/game-session.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class SessionAnalyticsService {
  constructor(
    @InjectRepository(QuestionStat) private readonly statRepo: Repository<QuestionStat>,
    @InjectRepository(GameSession) private readonly sessionRepo: Repository<GameSession>,
    private readonly redisService: RedisService,
  ) {}

  async computeAndSaveStats(gameSessionId: string, pin: string): Promise<void> {
    // Load the game session with quiz to get quiz questions
    const gameSession = await this.sessionRepo.findOne({
      where: { id: gameSessionId },
      relations: ['quiz', 'quiz.questions'],
    });
    if (!gameSession) return;

    const client = this.redisService.getClient();
    const questions = gameSession.quiz.questions ?? [];

    const stats: QuestionStat[] = [];

    for (const question of questions) {
      // Scan for all detail keys for this question in this session
      const pattern = `session:${pin}:question:${question.id}:detail:*`;
      const keys = await client.keys(pattern);

      if (keys.length === 0) continue;

      let correctCount = 0;
      let totalTimeTakenMs = 0;

      for (const key of keys) {
        const detail = await client.hgetall(key);
        if (!detail) continue;
        if (detail.correct === '1') correctCount++;
        totalTimeTakenMs += parseInt(detail.timeTakenMs ?? '0', 10);
      }

      const totalAnswers = keys.length;
      const avgTimeTakenMs = totalAnswers > 0 ? Math.round(totalTimeTakenMs / totalAnswers) : 0;

      const stat = this.statRepo.create({
        gameSession: { id: gameSessionId } as any,
        question: { id: question.id } as any,
        correctCount,
        totalAnswers,
        avgTimeTakenMs,
      });
      stats.push(stat);
    }

    if (stats.length > 0) {
      await this.statRepo.save(stats);
    }
  }
}
