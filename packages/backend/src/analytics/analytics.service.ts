import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession } from '../entities/game-session.entity';
import { QuestionStat } from '../entities/question-stat.entity';
import { Quiz } from '../entities/quiz.entity';
import { Subscription } from '../entities/subscription.entity';
import { QuizzesService } from '../quizzes/quizzes.service';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(GameSession) private readonly sessionRepo: Repository<GameSession>,
    @InjectRepository(QuestionStat) private readonly statRepo: Repository<QuestionStat>,
    @InjectRepository(Quiz) private readonly quizRepo: Repository<Quiz>,
    @InjectRepository(Subscription) private readonly subscriptionRepo: Repository<Subscription>,
    private readonly quizzesService: QuizzesService,
  ) {}

  async getQuizAnalytics(quizId: string, userId: string) {
    // Ownership check — throws ForbiddenException if not owner
    await this.quizzesService.findOne(quizId, userId);

    const sessions = await this.sessionRepo.find({
      where: { quiz: { id: quizId } },
      order: { playedAt: 'DESC' },
    });

    const questionStatsRaw = await this.statRepo.find({
      where: sessions.length > 0
        ? sessions.map((s) => ({ gameSession: { id: s.id } }))
        : [{ gameSession: { id: '' } }],
      relations: ['question', 'gameSession'],
    });

    const questionStats = questionStatsRaw.map((qs) => ({
      questionId: qs.question.id,
      questionText: qs.question.text,
      correctPercent:
        qs.totalAnswers > 0 ? Math.round((qs.correctCount / qs.totalAnswers) * 100) : 0,
      avgTimeTakenMs: qs.avgTimeTakenMs,
      totalAnswers: qs.totalAnswers,
      sessionId: qs.gameSession.id,
    }));

    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        pin: s.pin,
        playedAt: s.playedAt,
        playerCount: s.playerCount,
        leaderboardSnapshot: s.leaderboardSnapshot,
      })),
      questionStats,
    };
  }

  async getOverview(userId: string) {
    const sessions = await this.sessionRepo.find({
      where: { host: { id: userId } },
    });

    const totalSessions = sessions.length;
    const totalPlayers = sessions.reduce((acc, s) => acc + (s.playerCount ?? 0), 0);

    const topQuizResult = await this.quizRepo.findOne({
      where: { creator: { id: userId } },
      order: { playCount: 'DESC' },
    });

    const topQuiz = topQuizResult
      ? { id: topQuizResult.id, title: topQuizResult.title, playCount: topQuizResult.playCount }
      : null;

    return { totalSessions, totalPlayers, topQuiz };
  }

  async getAdminAnalytics() {
    // DAU: count distinct GameSession.playedAt dates grouped by day for last 30 days
    const dauRaw = await this.sessionRepo
      .createQueryBuilder('gs')
      .select("DATE_TRUNC('day', gs.playedAt)", 'date')
      .addSelect('COUNT(*)', 'count')
      .where("gs.playedAt >= NOW() - INTERVAL '30 days'")
      .groupBy("DATE_TRUNC('day', gs.playedAt)")
      .orderBy("DATE_TRUNC('day', gs.playedAt)", 'ASC')
      .getRawMany<{ date: Date; count: string }>();

    const dau = dauRaw.map((row) => ({
      date: row.date,
      count: parseInt(row.count, 10),
    }));

    // MAU: same grouped by month for last 6 months
    const mauRaw = await this.sessionRepo
      .createQueryBuilder('gs')
      .select("DATE_TRUNC('month', gs.playedAt)", 'month')
      .addSelect('COUNT(*)', 'count')
      .where("gs.playedAt >= NOW() - INTERVAL '6 months'")
      .groupBy("DATE_TRUNC('month', gs.playedAt)")
      .orderBy("DATE_TRUNC('month', gs.playedAt)", 'ASC')
      .getRawMany<{ month: Date; count: string }>();

    const mau = mauRaw.map((row) => ({
      month: row.month,
      count: parseInt(row.count, 10),
    }));

    // Tier counts
    const tierCountsRaw = await this.subscriptionRepo
      .createQueryBuilder('sub')
      .select('sub.tier', 'tier')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sub.tier')
      .getRawMany<{ tier: string; count: string }>();

    const tierCounts: Record<string, number> = { free: 0, starter: 0, pro: 0, business: 0 };
    for (const row of tierCountsRaw) {
      tierCounts[row.tier] = parseInt(row.count, 10);
    }

    return { dau, mau, tierCounts };
  }
}
