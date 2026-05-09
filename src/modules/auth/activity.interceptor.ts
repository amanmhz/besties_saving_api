import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  // Inactivity timeout: 30 minutes
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Only update activity if user is authenticated (has access_token cookie)
    const accessToken = request.cookies?.access_token;
    const lastActivity = request.cookies?.last_activity;

    if (accessToken && lastActivity) {
      // Reset the last_activity cookie to extend the session
      response.cookie('last_activity', Date.now().toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: this.INACTIVITY_TIMEOUT,
      });
    }

    return next.handle();
  }
}
