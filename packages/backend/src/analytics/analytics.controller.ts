import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // GET /analytics/quiz/:id — owner, requires JwtAuthGuard
  @UseGuards(JwtAuthGuard)
  @Get('quiz/:id')
  getQuizAnalytics(@Param('id') id: string, @Request() req: any) {
    return this.analyticsService.getQuizAnalytics(id, req.user.sub);
  }

  // GET /analytics/overview — owner, requires JwtAuthGuard
  @UseGuards(JwtAuthGuard)
  @Get('overview')
  getOverview(@Request() req: any) {
    return this.analyticsService.getOverview(req.user.sub);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('super_admin', 'admin')
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('analytics')
  getAdminAnalytics() {
    return this.analyticsService.getAdminAnalytics();
  }
}
