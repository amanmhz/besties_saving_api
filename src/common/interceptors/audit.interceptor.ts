import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog, ActionType } from '../../database/entities/activity-log.entity';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepo: Repository<ActivityLog>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;

    // Only log mutations
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      let action = ActionType.CREATE;
      if (method === 'PUT' || method === 'PATCH') action = ActionType.UPDATE;
      if (method === 'DELETE') action = ActionType.DELETE;

      // Clean the url for module name
      const module = url.split('/')[2] || 'UNKNOWN';

      return next.handle().pipe(
        tap(async (data) => {
          if (user) {
            // Save log to DB asyncly
            const log = this.activityLogRepo.create({
              user_id: user.id,
              action,
              module: module.toUpperCase(),
              payload: { requestBody: body, response: data },
            });
            await this.activityLogRepo.save(log).catch((err) => {
              console.error('Failed to save audit log', err);
            });
          }
        }),
      );
    }

    return next.handle();
  }
}
