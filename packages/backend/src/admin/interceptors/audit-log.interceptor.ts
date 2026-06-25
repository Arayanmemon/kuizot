import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from '../audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      method: string;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      path: string;
      user?: { sub?: string };
    }>();

    const method = req.method; // PATCH or DELETE
    const targetId = req.params?.id ?? 'unknown';
    const actorId = req.user?.sub ?? 'unknown';
    const controllerName = context.getClass().name; // e.g. 'AdminController'
    const action = `${method}_${controllerName.replace('Controller', '').toUpperCase()}`;

    return next.handle().pipe(
      tap(async () => {
        try {
          await this.auditLogService.log(
            action,
            actorId,
            this.resolveTargetType(req.path),
            targetId,
            { body: req.body, params: req.params },
          );
        } catch (err) {
          // Never let audit log failure break the response
          console.error('AuditLog write failed:', err);
        }
      }),
    );
  }

  private resolveTargetType(path: string): string {
    if (path.includes('/users/')) return 'User';
    if (path.includes('/quizzes/')) return 'Quiz';
    return 'Unknown';
  }
}
