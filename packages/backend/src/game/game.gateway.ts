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

interface JoinSessionPayload {
  pin: string;
  nickname: string;
  userId: string;
}

interface CreateSessionPayload {
  hostId: string;
}

interface StartQuestionPayload {
  pin: string;
  questionId: string;
  questionText: string;
  options: { id: string; text: string; color: string }[];
  timeLimit: number;
  scoringMode: 'classic' | 'accuracy';
  maxPoints: number;
}

interface SubmitAnswerPayload {
  pin: string;
  questionId: string;
  userId: string;
  nickname: string;
  optionId: string;
  timeTakenMs: number;
  scoringMode: 'classic' | 'accuracy';
  maxPoints: number;
  timeLimit: number;
  correctOptionId: string;
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
    const { hostId } = payload;
    
    try {
      const pin = await this.sessionService.createSession(hostId);
      
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
    const { pin, questionId, questionText, options, timeLimit, scoringMode, maxPoints } = payload;
    
    try {
      // Update session status and current question
      await this.sessionService.updateSessionStatus(pin, 'active');
      await this.sessionService.setCurrentQuestion(pin, questionId);
      
      // Broadcast question to all players in the session
      this.server.to(`session:${pin}`).emit('question_started', {
        questionId,
        questionText,
        options,
        timeLimit,
        scoringMode,
        maxPoints,
      });
      
      this.logger.log(`Question ${questionId} started in session ${pin}`);
    } catch (error) {
      this.logger.error(`Failed to start question: ${error.message}`);
      client.emit('error', { message: 'Failed to start question' });
    }
  }

  @SubscribeMessage('submit_answer')
  async handleSubmitAnswer(client: Socket, payload: SubmitAnswerPayload) {
    const { pin, questionId, userId, nickname, optionId, timeTakenMs, scoringMode, maxPoints, timeLimit, correctOptionId } = payload;
    
    try {
      // Check for idempotency (prevent double submissions)
      const isNew = await this.sessionService.submitAnswerIdempotent(pin, questionId, userId);
      
      if (!isNew) {
        client.emit('answer_error', { message: 'Answer already submitted' });
        return;
      }
      
      // Check if answer is correct
      const isCorrect = optionId === correctOptionId;
      
      // Calculate score
      const points = await this.scoringService.calculateScore(
        pin,
        userId,
        scoringMode,
        isCorrect,
        maxPoints,
        timeLimit,
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
      
      // Notify all players that the game has ended
      this.server.to(`session:${pin}`).emit('game_ended', { pin });
      
      this.logger.log(`Game ended for session ${pin}`);
    } catch (error) {
      this.logger.error(`Failed to end game: ${error.message}`);
      client.emit('error', { message: 'Failed to end game' });
    }
  }
}
