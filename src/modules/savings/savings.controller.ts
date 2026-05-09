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
  constructor(private readonly savingsService: SavingsService) { }

  @Post(':memberId/deposit')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async deposit(
    @Param('memberId') memberId: string,
    @Body() body: { amount: number, bs_date: string, deposit_type?: string, remarks?: string },
    @CurrentUser() admin: any
  ) {
    return this.savingsService.deposit(memberId, body.amount, body.bs_date, admin.id, body.deposit_type, body.remarks);
  }

  @Post(':memberId/withdraw')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async withdraw(
    @Param('memberId') memberId: string,
    @Body() body: { amount: number, bs_date: string, withdraw_type?: string, remarks?: string },
    @CurrentUser() admin: any
  ) {
    return this.savingsService.withdraw(memberId, body.amount, body.bs_date, admin.id, body.withdraw_type, body.remarks);
  }

  @Get('deposits')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MEMBER)
  async getAllDeposits(
    @Query('member_id') member_id?: string,
    @Query('created_by') created_by?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.savingsService.getAllDeposits({
      member_id,
      created_by,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10
    });
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
