import { Controller, Post, Body, UnauthorizedException, Res, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  // Inactivity timeout: 30 minutes (30 * 60 * 1000 ms)
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000;
  
  constructor(private authService: AuthService) { }

  @Post('login')
  async login(@Body() body: any, @Res({ passthrough: true }) response: Response) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokenData = await this.authService.login(user);

    // Access token cookie - short lived (15 minutes)
    response.cookie('access_token', tokenData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Refresh token cookie - long lived (7 days)
    response.cookie('refresh_token', tokenData.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Last activity cookie - for inactivity tracking (30 min)
    response.cookie('last_activity', Date.now().toString(), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: this.INACTIVITY_TIMEOUT
    });

    return { user: tokenData.user };
  }

  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.refresh_token;
    const lastActivity = request.cookies?.last_activity;

    if (!refreshToken) {
      throw new UnauthorizedException('No refresh token');
    }

    // Check inactivity - if user inactive for 30+ minutes, force re-login
    if (lastActivity) {
      const lastActivityTime = parseInt(lastActivity);
      const now = Date.now();
      const inactive = (now - lastActivityTime) > this.INACTIVITY_TIMEOUT;
      
      if (inactive) {
        // Clear all cookies and force re-login
        response.clearCookie('access_token');
        response.clearCookie('refresh_token');
        response.clearCookie('last_activity');
        throw new UnauthorizedException('Session expired due to inactivity. Please login again.');
      }
    }

    // Valid activity - issue new tokens
    const tokens = await this.authService.refreshTokens(refreshToken);

    // Set new access token
    response.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 15 * 60 * 1000
    });

    // Set new refresh token (rotate for security)
    response.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // Reset activity timer
    response.cookie('last_activity', Date.now().toString(), {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: this.INACTIVITY_TIMEOUT
    });

    return { message: 'Token refreshed' };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) response: Response) {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'none' as const,
      path: '/'
    };
    response.clearCookie('access_token', cookieOptions);
    response.clearCookie('refresh_token', cookieOptions);
    response.clearCookie('last_activity', cookieOptions);
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@CurrentUser() user: any) {
    return user;
  }
}
