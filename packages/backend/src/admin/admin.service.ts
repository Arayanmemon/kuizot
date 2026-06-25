import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { Quiz } from '../entities/quiz.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { GameSession } from '../entities/game-session.entity';
import { UpdateUserDto } from './dto/update-user.dto';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminStats {
  userCount: number;
  quizCount: number;
  activeSessionCount: number;
  confirmedRevenue: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Quiz)
    private readonly quizRepo: Repository<Quiz>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(GameSession)
    private readonly gameSessionRepo: Repository<GameSession>,
  ) {}

  async getUsers(
    page = 1,
    limit = 20,
    search?: string,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<User>> {
    const query = this.userRepo.createQueryBuilder('user');
    if (search) {
      query.where('user.email ILIKE :search OR user.username ILIKE :search', {
        search: `%${search}%`,
      });
    }
    query
      .orderBy(`user.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.suspended !== undefined) user.suspended = dto.suspended;
    return this.userRepo.save(user);
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    await this.userRepo.remove(user);
  }

  async getQuizzes(
    page = 1,
    limit = 20,
    search?: string,
    sortBy = 'createdAt',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<PaginatedResponse<Quiz>> {
    const query = this.quizRepo
      .createQueryBuilder('quiz')
      .leftJoinAndSelect('quiz.creator', 'creator');
    if (search) {
      query.where('quiz.title ILIKE :search', { search: `%${search}%` });
    }
    query
      .orderBy(`quiz.${sortBy}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async deleteQuiz(id: string): Promise<void> {
    const quiz = await this.quizRepo.findOne({ where: { id } });
    if (!quiz) throw new NotFoundException(`Quiz ${id} not found`);
    await this.quizRepo.remove(quiz);
  }

  async getStats(): Promise<AdminStats> {
    const userCount = await this.userRepo.count();
    const quizCount = await this.quizRepo.count();
    // Active session count will be added in Phase 4 (Redis-based)
    const activeSessionCount = 0;
    // Revenue calculation deferred to Phase 4 (billing module)
    const confirmedRevenue = 0;
    return { userCount, quizCount, activeSessionCount, confirmedRevenue };
  }

  async getAuditLog(page = 1, limit = 20): Promise<PaginatedResponse<AuditLog>> {
    const [data, total] = await this.auditLogRepo.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
}
