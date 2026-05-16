import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Calculates the final score for an answer.
   * Handles both 'classic' (speed-based decay) and 'accuracy' (fixed) modes,
   * applying a streak multiplier for consecutive correct answers.
   */
  async calculateScore(
    pin: string,
    userId: string,
    scoringMode: 'classic' | 'accuracy',
    isCorrect: boolean,
    maxPoints: number = 1000,
    timeLimitMs: number = 20000,
    timeTakenMs: number,
  ): Promise<number> {
    const client = this.redisService.getClient();
    const streakKey = `session:${pin}:user:${userId}:streak`;

    if (!isCorrect) {
      // Reset streak on incorrect answer and award 0 points
      await client.set(streakKey, 0);
      return 0;
    }

    // 1. Calculate Base Score depending on the mode
    let baseScore = 0;
    if (scoringMode === 'accuracy') {
      baseScore = maxPoints;
    } else {
      // Classic Mode: Decay logic
      if (timeTakenMs <= 1000) {
        baseScore = maxPoints; // Sub-second answer gets max points
      } else if (timeTakenMs >= timeLimitMs) {
        baseScore = maxPoints * 0.5; // Last second answer gets 50%
      } else {
        // Linear decay from 1 second to timeLimit
        const timeDecayWindow = timeLimitMs - 1000;
        const timeTakenInWindow = timeTakenMs - 1000;
        const penaltyRatio = timeTakenInWindow / timeDecayWindow;
        
        // Decay drops maxPoints down to 50% maxPoints
        const minPoints = maxPoints * 0.5;
        const availableDecayPoints = maxPoints - minPoints;
        
        baseScore = maxPoints - (availableDecayPoints * penaltyRatio);
      }
    }

    // 2. Apply Streak Multiplier
    // Increment streak count atomically
    const currentStreak = await client.incr(streakKey);
    // Ensure streak data cleans up eventually
    await client.expire(streakKey, 60 * 60 * 24);

    // Calculate multiplier: base 1.0 + 0.2 per streak > 1, capped at 2.0
    const streakMultiplier = Math.min(1.0 + (currentStreak - 1) * 0.2, 2.0);

    // 3. Final Calculation
    const finalScore = Math.round(baseScore * streakMultiplier);

    this.logger.debug(
      `Score calc for ${userId} [${scoringMode}]: Base=${Math.round(baseScore)}, Streak=${currentStreak}, Mult=${streakMultiplier.toFixed(1)}, Final=${finalScore}`,
    );

    return finalScore;
  }
}
