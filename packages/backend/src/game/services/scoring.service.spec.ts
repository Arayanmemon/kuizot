import { Test, TestingModule } from '@nestjs/testing';
import { ScoringService } from './scoring.service';
import { RedisService } from '../../redis/redis.service';

describe('ScoringService', () => {
  let service: ScoringService;
  let mockRedisClient: any;

  beforeEach(async () => {
    mockRedisClient = {
      set: jest.fn(),
      incr: jest.fn(),
      expire: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoringService,
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue(mockRedisClient),
          },
        },
      ],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Classic Mode', () => {
    it('should award 0 points for incorrect answers and reset streak', async () => {
      const score = await service.calculateScore('pin1', 'user1', 'classic', false, 1000, 20000, 500);
      expect(score).toBe(0);
      expect(mockRedisClient.set).toHaveBeenCalledWith('session:pin1:user:user1:streak', 0);
    });

    it('should award max points for sub-second correct answer with no streak', async () => {
      mockRedisClient.incr.mockResolvedValue(1); // Streak = 1
      const score = await service.calculateScore('pin1', 'user1', 'classic', true, 1000, 20000, 500);
      expect(score).toBe(1000); // 1000 * 1.0 multiplier
    });

    it('should apply linear decay for answers > 1 second', async () => {
      mockRedisClient.incr.mockResolvedValue(1); // Streak = 1
      // 10.5 seconds out of 20 seconds. 
      // Time penalty ratio = 9500 / 19000 = 0.5
      // Decay points available = 500. So 500 * 0.5 = 250 penalty.
      // Base score = 1000 - 250 = 750
      const score = await service.calculateScore('pin1', 'user1', 'classic', true, 1000, 20000, 10500);
      expect(score).toBe(750);
    });

    it('should award exactly 50% max points at the last millisecond', async () => {
      mockRedisClient.incr.mockResolvedValue(1); // Streak = 1
      const score = await service.calculateScore('pin1', 'user1', 'classic', true, 1000, 20000, 20000);
      expect(score).toBe(500);
    });
  });

  describe('Accuracy Mode', () => {
    it('should award max points regardless of time taken', async () => {
      mockRedisClient.incr.mockResolvedValue(1); // Streak = 1
      const score = await service.calculateScore('pin1', 'user1', 'accuracy', true, 1000, 20000, 19999);
      expect(score).toBe(1000);
    });
  });

  describe('Streak Multiplier', () => {
    it('should apply a 1.2x multiplier for a streak of 2', async () => {
      mockRedisClient.incr.mockResolvedValue(2);
      const score = await service.calculateScore('pin1', 'user1', 'classic', true, 1000, 20000, 500);
      expect(score).toBe(1200);
    });

    it('should cap the multiplier at 2.0x for streaks >= 6', async () => {
      mockRedisClient.incr.mockResolvedValue(6);
      const score = await service.calculateScore('pin1', 'user1', 'accuracy', true, 1000, 20000, 15000);
      expect(score).toBe(2000); // 1000 base * 2.0 multiplier

      mockRedisClient.incr.mockResolvedValue(10);
      const scoreCap = await service.calculateScore('pin1', 'user1', 'accuracy', true, 1000, 20000, 15000);
      expect(scoreCap).toBe(2000);
    });
  });
});
