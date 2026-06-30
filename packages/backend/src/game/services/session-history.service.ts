import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession } from '../../entities/game-session.entity';
import { Quiz } from '../../entities/quiz.entity';
import { LeaderboardEntry } from './leaderboard.service';

@Injectable()
export class SessionHistoryService {
  constructor(
    @InjectRepository(GameSession)
    private readonly gameSessionRepo: Repository<GameSession>,
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
  ) {}

  async saveSession(
    pin: string,
    quizId: string,
    hostId: string,
    playerCount: number,
    leaderboard: LeaderboardEntry[],
  ): Promise<GameSession> {
    const session = this.gameSessionRepo.create({
      pin,
      quiz: { id: quizId } as any,
      host: { id: hostId } as any,
      playerCount,
      leaderboardSnapshot: leaderboard,
    });
    const savedSession = await this.gameSessionRepo.save(session);
    await this.quizRepo.increment({ id: quizId }, 'playCount', 1);
    return savedSession;
  }
}
