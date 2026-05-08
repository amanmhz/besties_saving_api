import { Controller, Get, Post, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { SavingsService } from './savings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';

@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(private readonly savingsService: SavingsService) {}

  @Post(':memberId/deposit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async deposit(
    @Param('memberId') memberId: string,
    @Body() body: { amount: number, bs_date: string },
    @CurrentUser() admin: any
  ) {
    return this.savingsService.deposit(memberId, body.amount, body.bs_date, admin.id);
  }

  @Get('deposits')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getAllDeposits(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.savingsService.getAllDeposits(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get('my-account')
  async getMyAccount(@CurrentUser() user: any) {
    return this.savingsService.getAccountByMember(user.id);
  }

  @Get(':memberId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getAccount(@Param('memberId') memberId: string) {
    return this.savingsService.getAccountByMember(memberId);
  }
}
