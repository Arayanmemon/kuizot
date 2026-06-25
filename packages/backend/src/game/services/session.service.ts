import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';
import { PinService } from './pin.service';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly pinService: PinService,
  ) {}

  /**
   * Initializes a new game session and maps it to a unique PIN.
   */
  async createSession(hostId: string, quizId: string): Promise<string> {
    const pin = await this.pinService.createUniquePin();
    const client = this.redisService.getClient();

    // Map the session metadata using HSET
    await client.hset(`session:${pin}`, {
      host_id: hostId,
      quiz_id: quizId,
      status: 'waiting', // waiting, active, finished
      current_question_id: '',
    });

    // Optional: Set a TTL (e.g., 24 hours) to automatically clean up orphaned sessions
    await client.expire(`session:${pin}`, 60 * 60 * 24);

    this.logger.log(`Session created for Host ${hostId} with PIN ${pin}`);
    return pin;
  }

  /**
   * Retrieves session metadata.
   */
  async getSession(pin: string): Promise<{ hostId: string; quizId: string; status: string; currentQuestionId: string } | null> {
    const client = this.redisService.getClient();
    const data = await client.hgetall(`session:${pin}`);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }
    
    return {
      hostId: data.host_id,
      quizId: data.quiz_id,
      status: data.status,
      currentQuestionId: data.current_question_id,
    };
  }

  /**
   * Updates the status of the session (e.g., waiting -> active).
   */
  async updateSessionStatus(pin: string, status: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.hset(`session:${pin}`, 'status', status);
  }

  /**
   * Updates the current question being broadcasted.
   */
  async setCurrentQuestion(pin: string, questionId: string): Promise<void> {
    const client = this.redisService.getClient();
    await client.hset(`session:${pin}`, 'current_question_id', questionId);
  }

  /**
   * Records a user's answer submission using SADD for idempotency.
   * Returns true if the submission is recorded, false if the user already submitted an answer.
   */
  async submitAnswerIdempotent(pin: string, questionId: string, userId: string): Promise<boolean> {
    const client = this.redisService.getClient();
    const key = `session:${pin}:question:${questionId}:answers`;

    // SADD returns 1 if the element was added, 0 if it already existed
    const result = await client.sadd(key, userId);

    if (result === 1) {
      // Set an expiry so this data doesn't persist forever after the game
      await client.expire(key, 60 * 60 * 24);
      return true;
    }

    this.logger.warn(`User ${userId} attempted to submit a duplicate answer for question ${questionId}`);
    return false;
  }
}
