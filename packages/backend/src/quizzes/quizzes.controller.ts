import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuizzesService } from './quizzes.service';
import { CreateQuizDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';

@UseGuards(JwtAuthGuard)
@Controller('quizzes')
export class QuizzesController {
  constructor(private readonly quizzesService: QuizzesService) {}

  @Get()
  findAll(@Request() req: { user: JwtPayload }) {
    return this.quizzesService.findAllByOwner(req.user.sub);
  }

  @Post()
  create(@Body() dto: CreateQuizDto, @Request() req: { user: JwtPayload }) {
    // Build a partial User object with just the id so the service can set the relation
    const userRef = { id: req.user.sub } as any;
    return this.quizzesService.create(dto, userRef);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.quizzesService.findOne(id, req.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuizDto,
    @Request() req: { user: JwtPayload },
  ) {
    return this.quizzesService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.quizzesService.remove(id, req.user.sub);
  }

  @Get(':id/questions')
  findQuestions(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.quizzesService.findQuestions(id, req.user.sub);
  }

  @Get(':id/sessions')
  findSessions(@Param('id') id: string, @Request() req: { user: JwtPayload }) {
    return this.quizzesService.findSessions(id, req.user.sub);
  }
}
