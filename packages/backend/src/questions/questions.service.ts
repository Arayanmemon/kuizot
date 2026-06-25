import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
import { Option } from '../entities/option.entity';
import { QuizzesService } from '../quizzes/quizzes.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionDto } from './dto/reorder-question.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';

@Injectable()
export class QuestionsService {
  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @InjectRepository(Option)
    private readonly optionRepository: Repository<Option>,
    private readonly quizzesService: QuizzesService,
  ) {}

  /**
   * Finds a question and verifies it belongs to a quiz owned by the given user.
   * Throws NotFoundException if not found, ForbiddenException if not owner.
   */
  async findQuestionWithOwnershipCheck(
    questionId: string,
    userId: string,
  ): Promise<Question> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: ['quiz', 'quiz.creator', 'options'],
    });

    if (!question) {
      throw new NotFoundException('Question not found');
    }

    if (question.quiz.creator.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return question;
  }

  /**
   * Adds a question to a quiz. Verifies quiz ownership first.
   */
  async addQuestion(
    quizId: string,
    dto: CreateQuestionDto,
    userId: string,
  ): Promise<Question> {
    // Verifies ownership — throws if not owner
    await this.quizzesService.findOne(quizId, userId);

    const question = this.questionRepository.create({
      text: dto.text,
      order: dto.order,
      ...(dto.timeLimit !== undefined && { timeLimit: dto.timeLimit }),
      ...(dto.scoringMode !== undefined && { scoringMode: dto.scoringMode }),
      quiz: { id: quizId } as any,
    });

    return this.questionRepository.save(question);
  }

  /**
   * Updates question fields (text, timeLimit, scoringMode, imageUrl).
   */
  async updateQuestion(
    questionId: string,
    dto: UpdateQuestionDto,
    userId: string,
  ): Promise<Question> {
    const question = await this.findQuestionWithOwnershipCheck(questionId, userId);
    Object.assign(question, dto);
    return this.questionRepository.save(question);
  }

  /**
   * Deletes a question.
   */
  async deleteQuestion(questionId: string, userId: string): Promise<void> {
    const question = await this.findQuestionWithOwnershipCheck(questionId, userId);
    await this.questionRepository.remove(question);
  }

  /**
   * Updates the order of a question.
   */
  async reorderQuestion(
    questionId: string,
    dto: ReorderQuestionDto,
    userId: string,
  ): Promise<Question> {
    const question = await this.findQuestionWithOwnershipCheck(questionId, userId);
    question.order = dto.order;
    return this.questionRepository.save(question);
  }

  /**
   * Loads question at the given 0-based index from a quiz, ordered by `order` ASC.
   * Throws NotFoundException if out of bounds. Eagerly loads options.
   */
  async getQuestionByIndex(
    quizId: string,
    questionIndex: number,
  ): Promise<Question> {
    const questions = await this.questionRepository.find({
      where: { quiz: { id: quizId } },
      relations: ['options'],
      order: { order: 'ASC' },
    });

    if (questionIndex < 0 || questionIndex >= questions.length) {
      throw new NotFoundException(
        `Question at index ${questionIndex} not found in quiz ${quizId}`,
      );
    }

    return questions[questionIndex];
  }

  /**
   * Loads a single question by ID with options eagerly loaded.
   * Used by GameGateway to validate answers server-side.
   */
  async getQuestionById(questionId: string): Promise<Question> {
    const question = await this.questionRepository.findOne({
      where: { id: questionId },
      relations: ['options'],
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    return question;
  }

  /**
   * Adds an option to a question.
   */
  async addOption(
    questionId: string,
    dto: CreateOptionDto,
    userId: string,
  ): Promise<Option> {
    await this.findQuestionWithOwnershipCheck(questionId, userId);

    const option = this.optionRepository.create({
      text: dto.text,
      color: dto.color,
      isCorrect: dto.isCorrect ?? false,
      question: { id: questionId } as any,
    });

    return this.optionRepository.save(option);
  }

  /**
   * Updates an option. Verifies the option's question belongs to a quiz owned by the user.
   */
  async updateOption(
    optionId: string,
    dto: UpdateOptionDto,
    userId: string,
  ): Promise<Option> {
    const option = await this.optionRepository.findOne({
      where: { id: optionId },
      relations: ['question', 'question.quiz', 'question.quiz.creator'],
    });

    if (!option) {
      throw new NotFoundException('Option not found');
    }

    if (option.question.quiz.creator.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    Object.assign(option, dto);
    return this.optionRepository.save(option);
  }

  /**
   * Deletes an option. Verifies ownership.
   */
  async deleteOption(optionId: string, userId: string): Promise<void> {
    const option = await this.optionRepository.findOne({
      where: { id: optionId },
      relations: ['question', 'question.quiz', 'question.quiz.creator'],
    });

    if (!option) {
      throw new NotFoundException('Option not found');
    }

    if (option.question.quiz.creator.id !== userId) {
      throw new ForbiddenException('Access denied');
    }

    await this.optionRepository.remove(option);
  }
}
