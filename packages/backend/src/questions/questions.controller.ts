import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuestionsService } from './questions.service';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ReorderQuestionDto } from './dto/reorder-question.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { UpdateOptionDto } from './dto/update-option.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class QuestionsController {
  constructor(private readonly questionsService: QuestionsService) {}

  /** POST /quizzes/:id/questions — add question to quiz */
  @Post('quizzes/:id/questions')
  addQuestion(
    @Param('id') quizId: string,
    @Body() dto: CreateQuestionDto,
    @Request() req: any,
  ) {
    return this.questionsService.addQuestion(quizId, dto, req.user.sub);
  }

  /** PATCH /questions/:id — edit question */
  @Patch('questions/:id')
  updateQuestion(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionDto,
    @Request() req: any,
  ) {
    return this.questionsService.updateQuestion(id, dto, req.user.sub);
  }

  /** DELETE /questions/:id — delete question */
  @Delete('questions/:id')
  deleteQuestion(@Param('id') id: string, @Request() req: any) {
    return this.questionsService.deleteQuestion(id, req.user.sub);
  }

  /** PATCH /questions/:id/reorder — reorder question */
  @Patch('questions/:id/reorder')
  reorderQuestion(
    @Param('id') id: string,
    @Body() dto: ReorderQuestionDto,
    @Request() req: any,
  ) {
    return this.questionsService.reorderQuestion(id, dto, req.user.sub);
  }

  /** POST /questions/:id/options — add option to question */
  @Post('questions/:id/options')
  addOption(
    @Param('id') questionId: string,
    @Body() dto: CreateOptionDto,
    @Request() req: any,
  ) {
    return this.questionsService.addOption(questionId, dto, req.user.sub);
  }

  /** PATCH /options/:id — edit option */
  @Patch('options/:id')
  updateOption(
    @Param('id') optionId: string,
    @Body() dto: UpdateOptionDto,
    @Request() req: any,
  ) {
    return this.questionsService.updateOption(optionId, dto, req.user.sub);
  }

  /** DELETE /options/:id — delete option */
  @Delete('options/:id')
  deleteOption(@Param('id') optionId: string, @Request() req: any) {
    return this.questionsService.deleteOption(optionId, req.user.sub);
  }
}
