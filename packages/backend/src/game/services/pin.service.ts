import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class PinService {
  private readonly logger = new Logger(PinService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generates a random 6-digit PIN.
   */
  private generatePin(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Creates a unique Game PIN on demand.
   * Checks Redis to ensure the PIN is not already in use by an active session.
   */
  async createUniquePin(): Promise<string> {
    const client = this.redisService.getClient();
    let isUnique = false;
    let pin = '';

    while (!isUnique) {
      pin = this.generatePin();
      // Check if a session with this PIN already exists
      const exists = await client.exists(`session:${pin}`);
      if (exists === 0) {
        isUnique = true;
      }
    }

    this.logger.log(`Generated unique Game PIN: ${pin}`);
    return pin;
  }
}
