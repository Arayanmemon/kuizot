import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

export interface LeaderboardEntry {
  userId: string;
  score: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Increases a player's score on the real-time leaderboard using ZINCRBY.
   */
  async updatePlayerScore(pin: string, userId: string, pointsToAdd: number): Promise<number> {
    const client = this.redisService.getClient();
    const key = `session:${pin}:leaderboard`;

    // Atomically increment the user's score in the sorted set
    const newScoreString = await client.zincrby(key, pointsToAdd, userId);
    const newScore = parseFloat(newScoreString);

    // Set TTL on the leaderboard if not already set (just to be safe against memory leaks)
    await client.expire(key, 60 * 60 * 24);

    this.logger.log(`Updated score for user ${userId} in session ${pin}: ${newScore}`);
    return newScore;
  }

  /**
   * Retrieves the top N players from the leaderboard.
   */
  async getTopPlayers(pin: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const client = this.redisService.getClient();
    const key = `session:${pin}:leaderboard`;

    // Get the top players in descending order with their scores
    // ZREVRANGE returns an array like: [ 'userId1', '100', 'userId2', '90' ]
    const rawData = await client.zrevrange(key, 0, limit - 1, 'WITHSCORES');

    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < rawData.length; i += 2) {
      leaderboard.push({
        userId: rawData[i],
        score: parseFloat(rawData[i + 1]),
      });
    }

    return leaderboard;
  }
}
