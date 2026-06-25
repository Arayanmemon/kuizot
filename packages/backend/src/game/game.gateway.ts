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
      
      // Notify host about the answer
      this.server.to(`session:${pin}:host`).emit('answer_received', {
        userId,
        nickname,
        optionId,
        isCorrect,
        points,
      });
      
      // Notify player of their result
      client.emit('answer_result', {
        isCorrect,
        points,
        correctOptionId,
      });
      
      this.logger.log(`Answer from ${nickname}: ${isCorrect ? 'Correct' : 'Wrong'} (+${points} pts)`);
    } catch (error) {
      this.logger.error(`Failed to submit answer: ${error.message}`);
      client.emit('answer_error', { message: 'Failed to submit answer' });
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
        await this.sessionHistoryService.saveSession(pin, quizId, hostId, playerCount, leaderboard);
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
