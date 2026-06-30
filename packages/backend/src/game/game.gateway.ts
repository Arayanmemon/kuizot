import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SessionService } from './services/session.service';
import { LeaderboardService } from './services/leaderboard.service';
import { ScoringService } from './services/scoring.service';
import { QuestionsService } from '../questions/questions.service';
import { SessionHistoryService } from './services/session-history.service';
import { BillingService } from '../billing/billing.service';
import { CreditsService } from '../billing/credits/credits.service';
import { RedisService } from '../redis/redis.service';
import { SessionAnalyticsService } from '../analytics/session-analytics.service';

interface JoinSessionPayload {
  pin: string;
  nickname: string;
  userId: string;
}

interface CreateSessionPayload {
  hostId: string;
  quizId: string;
}

interface StartQuestionPayload {
  pin: string;
  questionIndex: number; // 0-based index
}

interface SubmitAnswerPayload {
  pin: string;
  questionId: string;
  userId: string;
  nickname: string;
  optionId: string;
  timeTakenMs: number;
  // scoringMode, maxPoints, timeLimit, correctOptionId are intentionally NOT
  // accepted from the client — all correctness logic runs server-side using the DB
}

@WebSocketGateway({
  namespace: '/game',
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameGateway.name);

  // In-memory tracking of socket -> session mapping for disconnect cleanup
  private socketSessionMap = new Map<string, { pin: string; userId: string; nickname: string; role: 'host' | 'player' }>();

  constructor(
    private readonly sessionService: SessionService,
    private readonly leaderboardService: LeaderboardService,
    private readonly scoringService: ScoringService,
    private readonly questionsService: QuestionsService,
    private readonly sessionHistoryService: SessionHistoryService,
    private readonly billingService: BillingService,
    private readonly creditsService: CreditsService,
    private readonly redisService: RedisService,
    private readonly sessionAnalyticsService: SessionAnalyticsService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    // Clean up player from session on disconnect
    const sessionInfo = this.socketSessionMap.get(client.id);
    if (sessionInfo && sessionInfo.role === 'player') {
      const { pin, userId, nickname } = sessionInfo;
      
      // Notify host that player left
      client.to(`session:${pin}:host`).emit('player_left', { userId, nickname });
      
      this.logger.log(`Player ${nickname} (${userId}) left session ${pin}`);
    }
    
    this.socketSessionMap.delete(client.id);
  }

  @SubscribeMessage('create_session')
  async handleCreateSession(client: Socket, payload: CreateSessionPayload) {
    const { hostId, quizId } = payload;
    
    try {
      // Check billing limit before creating session
      const billingCheck = await this.billingService.checkLimit(hostId, 'session_start');
      if (!billingCheck.allowed) {
        client.emit('session_error', { message: billingCheck.reason });
        return;
      }

      const pin = await this.sessionService.createSession(hostId, quizId);

      // Deduct the session-start credit cost from the host's account
      // Only deduct if the host has a subscription (graceful for anonymous hosts)
      try {
        const cost = parseInt(process.env.CREDIT_COST_SESSION_START ?? '5', 10);
        await this.creditsService.deductCredits(hostId, cost, 'session_start', pin);
      } catch (billingErr) {
        this.logger.warn(`Credit deduction failed for host ${hostId}: ${billingErr.message}`);
        // Non-fatal — session is already created, continue
      }

      // Join the host room for this session
      client.join(`session:${pin}:host`);
      client.join(`session:${pin}`);
      
      // Track this socket
      this.socketSessionMap.set(client.id, { pin, userId: hostId, nickname: 'Host', role: 'host' });
      
      this.logger.log(`Session created with PIN ${pin} by host ${hostId}`);
      
      client.emit('session_created', { pin, hostId });
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      client.emit('error', { message: 'Failed to create session' });
    }
  }

  @SubscribeMessage('join_session')
  async handleJoinSession(client: Socket, payload: JoinSessionPayload) {
    const { pin, nickname, userId } = payload;
    
    try {
      // Check if session exists
      const sessionData = await this.sessionService.getSession(pin);
      
      if (!sessionData) {
        client.emit('join_error', { message: 'Invalid Game PIN' });
        return;
      }
      
      if (sessionData.status !== 'waiting') {
        client.emit('join_error', { message: 'Game already in progress' });
        return;
      }
      
      // Check billing limit for player join
      const billingCheck = await this.billingService.checkLimit(sessionData.hostId, 'player_join');
      if (!billingCheck.allowed) {
        client.emit('join_error', { message: billingCheck.reason });
        return;
      }

      // Join the session room
      client.join(`session:${pin}`);
      
      // Deduct the per-player credit cost from the host's account
      try {
        const cost = parseInt(process.env.CREDIT_COST_PER_PLAYER ?? '1', 10);
        await this.creditsService.deductCredits(sessionData.hostId, cost, 'player_join', pin);
      } catch (billingErr) {
        this.logger.warn(`Per-player credit deduction failed for host ${sessionData.hostId}: ${billingErr.message}`);
        // Non-fatal — player already joined
      }

      // Track this socket
      this.socketSessionMap.set(client.id, { pin, userId, nickname, role: 'player' });
      
      // Notify the host about the new player
      this.server.to(`session:${pin}:host`).emit('player_joined', { userId, nickname });
      
      this.logger.log(`Player ${nickname} (${userId}) joined session ${pin}`);
      
      client.emit('join_success', { pin, userId, nickname });
    } catch (error) {
      this.logger.error(`Failed to join session: ${error.message}`);
      client.emit('join_error', { message: 'Failed to join session' });
    }
  }

  @SubscribeMessage('start_question')
  async handleStartQuestion(client: Socket, payload: StartQuestionPayload) {
    const { pin, questionIndex } = payload;
    
    try {
      // Load session to get quiz_id
      const session = await this.sessionService.getSession(pin);
      if (!session) {
        client.emit('error', { message: 'Session not found' });
        return;
      }

      // Load question from DB by index
      const question = await this.questionsService.getQuestionByIndex(session.quizId, questionIndex);

      // Update session status and current question
      await this.sessionService.updateSessionStatus(pin, 'active');
      await this.sessionService.setCurrentQuestion(pin, question.id);
      
      // Broadcast question to all players in the session
      this.server.to(`session:${pin}`).emit('question_started', {
        questionId: question.id,
        questionText: question.text,
        options: question.options.map((o) => ({ id: o.id, text: o.text, color: o.color })),
        timeLimit: question.timeLimit,
        scoringMode: question.scoringMode,
        maxPoints: question.points,
        imageUrl: question.imageUrl ?? null,
      });
      
      this.logger.log(`Question ${question.id} (index ${questionIndex}) started in session ${pin}`);
    } catch (error) {
      this.logger.error(`Failed to start question: ${error.message}`);
      client.emit('error', { message: 'Failed to start question' });
    }
  }

  @SubscribeMessage('submit_answer')
  async handleSubmitAnswer(client: Socket, payload: SubmitAnswerPayload) {
    const { pin, questionId, userId, nickname, optionId, timeTakenMs } = payload;
    
    try {
      // Check for idempotency (prevent double submissions)
      const isNew = await this.sessionService.submitAnswerIdempotent(pin, questionId, userId);
      
      if (!isNew) {
        client.emit('answer_error', { message: 'Answer already submitted' });
        return;
      }

      // Load the question from DB to get the correct option — never trust the client
      const question = await this.questionsService.getQuestionById(questionId);
      const correctOption = question.options.find((o) => o.isCorrect);
      const correctOptionId = correctOption?.id ?? '';
      
      // Check if answer is correct
      const isCorrect = optionId === correctOptionId;
      
      // Write per-answer detail for analytics (includes chosen optionId for stats)
      const redisClient = this.redisService.getClient();
      await redisClient.hset(
        `session:${pin}:question:${questionId}:detail:${userId}`,
        'correct', isCorrect ? '1' : '0',
        'timeTakenMs', String(timeTakenMs),
        'optionId', optionId,
      );
      await redisClient.expire(
        `session:${pin}:question:${questionId}:detail:${userId}`,
        60 * 60 * 24,
      );
      
      // Calculate score
      const points = await this.scoringService.calculateScore(
        pin,
        userId,
        question.scoringMode,
        isCorrect,
        question.points,
        question.timeLimit * 1000, // convert seconds → ms
        timeTakenMs,
      );
      
      // Update leaderboard if correct
      if (points > 0) {
        await this.leaderboardService.updatePlayerScore(pin, userId, points);
      }
      
      // Notify host about the answer (host sees live answer count + which option)
      this.server.to(`session:${pin}:host`).emit('answer_received', {
        userId,
        nickname,
        optionId,
        isCorrect,
        points,
      });
      
      // Acknowledge submission to player WITHOUT revealing correctness yet
      // The correct answer is revealed when the host shows question stats
      client.emit('answer_submitted', { questionId });
      
      this.logger.log(`Answer from ${nickname}: ${isCorrect ? 'Correct' : 'Wrong'} (+${points} pts)`);
    } catch (error) {
      this.logger.error(`Failed to submit answer: ${error.message}`);
      client.emit('answer_error', { message: 'Failed to submit answer' });
    }
  }

  @SubscribeMessage('show_question_stats')
  async handleShowQuestionStats(client: Socket, payload: { pin: string }) {
    const { pin } = payload;

    try {
      const redisClient = this.redisService.getClient();

      // Get the current question ID from Redis
      const session = await this.sessionService.getSession(pin);
      if (!session?.currentQuestionId) {
        client.emit('error', { message: 'No current question' });
        return;
      }

      const questionId = session.currentQuestionId;
      const question = await this.questionsService.getQuestionById(questionId);

      // Aggregate per-option counts from Redis detail keys
      const pattern = `session:${pin}:question:${questionId}:detail:*`;
      const keys = await redisClient.keys(pattern);

      const optionCounts: Record<string, number> = {};
      const playerResults: Record<string, { isCorrect: boolean; points: number; optionId: string }> = {};

      question.options.forEach((o) => { optionCounts[o.id] = 0; });

      for (const key of keys) {
        const detail = await redisClient.hgetall(key);
        if (!detail) continue;
        const chosenOptionId = detail.optionId;
        if (chosenOptionId && optionCounts[chosenOptionId] !== undefined) {
          optionCounts[chosenOptionId]++;
        }
        // Extract userId from key: session:<pin>:question:<qId>:detail:<userId>
        const parts = key.split(':');
        const playerId = parts[parts.length - 1];
        const isCorrect = detail.correct === '1';
        // Re-derive points from scoring service would be expensive; store them in Redis instead
        // For now, just store isCorrect — points are already in the leaderboard
        playerResults[playerId] = {
          isCorrect,
          points: 0, // will be read from leaderboard
          optionId: chosenOptionId ?? '',
        };
      }

      const totalAnswers = keys.length;
      const optionsWithStats = question.options.map((o) => ({
        id: o.id,
        text: o.text,
        color: o.color,
        isCorrect: o.isCorrect,
        count: optionCounts[o.id] ?? 0,
        percent: totalAnswers > 0 ? Math.round(((optionCounts[o.id] ?? 0) / totalAnswers) * 100) : 0,
      }));

      // Broadcast aggregate stats to host
      this.server.to(`session:${pin}:host`).emit('question_stats', {
        questionId,
        questionText: question.text,
        options: optionsWithStats,
        totalAnswers,
      });

      // Send personal result to each player (reveal correct/wrong NOW)
      const correctOption = question.options.find((o) => o.isCorrect);
      const correctOptionId = correctOption?.id ?? '';

      for (const [playerId, result] of Object.entries(playerResults)) {
        // Find the socket for this player
        for (const [socketId, info] of this.socketSessionMap.entries()) {
          if (info.userId === playerId && info.pin === pin) {
            const playerSocket = this.server.sockets.sockets.get(socketId);
            if (playerSocket) {
              playerSocket.emit('answer_reveal', {
                isCorrect: result.isCorrect,
                correctOptionId,
                chosenOptionId: result.optionId,
              });
            }
            break;
          }
        }
      }

      // Players who didn't answer get the reveal too (all wrong)
      for (const [socketId, info] of this.socketSessionMap.entries()) {
        if (info.pin === pin && info.role === 'player' && !playerResults[info.userId]) {
          const playerSocket = this.server.sockets.sockets.get(socketId);
          if (playerSocket) {
            playerSocket.emit('answer_reveal', {
              isCorrect: false,
              correctOptionId,
              chosenOptionId: null,
            });
          }
        }
      }

      this.logger.log(`Question stats shown for session ${pin}, question ${questionId}`);
    } catch (error) {
      this.logger.error(`Failed to show question stats: ${error.message}`);
      client.emit('error', { message: 'Failed to show question stats' });
    }
  }

  @SubscribeMessage('show_leaderboard')
  async handleShowLeaderboard(client: Socket, payload: { pin: string }) {
    const { pin } = payload;
    
    try {
      const leaderboard = await this.leaderboardService.getTopPlayers(pin, 10);
      
      // Broadcast leaderboard to all players in the session
      this.server.to(`session:${pin}`).emit('leaderboard_update', { leaderboard });
      
      this.logger.log(`Leaderboard shown for session ${pin}`);
    } catch (error) {
      this.logger.error(`Failed to show leaderboard: ${error.message}`);
      client.emit('error', { message: 'Failed to show leaderboard' });
    }
  }

  @SubscribeMessage('close_session')
  async handleCloseSession(client: Socket, payload: { pin: string }) {
    const { pin } = payload;
    // Notify all players the session is closed so they can clear state
    this.server.to(`session:${pin}`).emit('session_closed', { pin });
    this.logger.log(`Session ${pin} closed by host`);
  }

  @SubscribeMessage('end_game')
  async handleEndGame(client: Socket, payload: { pin: string }) {
    const { pin } = payload;
    
    try {
      await this.sessionService.updateSessionStatus(pin, 'finished');

      // Get the final leaderboard (all players)
      const leaderboard = await this.leaderboardService.getTopPlayers(pin, 100);

      // Get session data for hostId and quizId
      const session = await this.sessionService.getSession(pin);
      if (session) {
        const { hostId, quizId } = session;
        const playerCount = leaderboard.length;
        const savedSession = await this.sessionHistoryService.saveSession(pin, quizId, hostId, playerCount, leaderboard);
        // Compute and persist per-question analytics
        await this.sessionAnalyticsService.computeAndSaveStats(savedSession.id, pin);
      }
      
      // Notify all players that the game has ended
      this.server.to(`session:${pin}`).emit('game_ended', { pin });
      
      this.logger.log(`Game ended for session ${pin}`);
    } catch (error) {
      this.logger.error(`Failed to end game: ${error.message}`);
      client.emit('error', { message: 'Failed to end game' });
    }
  }
}
