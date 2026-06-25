import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Quiz } from '../entities/quiz.entity';
import { Question } from '../entities/question.entity';
import { GameSession } from '../entities/game-session.entity';
import { User } from '../entities/user.entity';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';

@Injectable()
export class QuizzesService {
  constructor(
    @InjectRepository(Quiz)
    private readonly quizRepository: Repository<Quiz>,
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(GameSession)
    private readonly gameSessionRepository: Repository<GameSession>,
  ) {}

  async findAllByOwner(userId: string): Promise<Quiz[]> {
    return this.quizRepository.find({
      where: { creator: { id: userId } },
      relations: ['creator'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(dto: CreateQuizDto, user: User): Promise<Quiz> {
    const quiz = this.quizRepository.create({
      title: dto.title,
      ...(dto.description !== undefined && { description: dto.description }),
      creator: user,
    });
    return this.quizRepository.save(quiz) as Promise<Quiz>;
  }

  async findOne(id: string, userId: string): Promise<Quiz> {
    const quiz = await this.quizRepository.findOne({
      where: { id },
      relations: ['creator'],
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (quiz.creator.id !== userId) throw new ForbiddenException('Access denied');
    return quiz;
  }

  async update(id: string, dto: UpdateQuizDto, userId: string): Promise<Quiz> {
    const quiz = await this.findOne(id, userId);
    Object.assign(quiz, dto);
    return this.quizRepository.save(quiz);
  }

  async remove(id: string, userId: string): Promise<void> {
    const quiz = await this.findOne(id, userId);
    await this.quizRepository.remove(quiz);
  }

  async findQuestions(id: string, userId: string): Promise<Question[]> {
    await this.findOne(id, userId); // ownership check
    return this.questionRepository.find({
      where: { quiz: { id } },
      relations: ['options'],
      order: { order: 'ASC' },
    });
  }

  async findSessions(quizId: string, userId: string): Promise<GameSession[]> {
    await this.findOne(quizId, userId); // ownership check
    return this.gameSessionRepository.find({
      where: { quiz: { id: quizId } },
      order: { playedAt: 'DESC' },
    });
  }
}
