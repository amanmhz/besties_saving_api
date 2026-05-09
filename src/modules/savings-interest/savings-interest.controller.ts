import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { SavingsInterestService } from './savings-interest.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';

@Controller('savings-interest')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsInterestController {
  constructor(private readonly service: SavingsInterestService) { }

  @Post('add')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async addInterest(
    @Body() body: { amount: number, bs_date: string, remarks: string },
    @CurrentUser() admin: any
  ) {
    return this.service.addInterest(body.amount, body.bs_date, admin.id, body.remarks);
  }

  @Post('withdraw')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async withdrawInterest(
    @Body() body: { member_id: string, amount: number, bs_date: string, withdraw_type: string, remarks: string },
    @CurrentUser() admin: any
  ) {
    return this.service.withdrawInterest(body.member_id, body.amount, body.bs_date, admin.id, body.withdraw_type, body.remarks);
  }

  @Post('withdraw-bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async withdrawInterestBulk(
    @Body() body: {
      withdrawals: { memberId: string; amount: number; withdrawType: string; remarks: string }[],
      bs_date: string
    },
    @CurrentUser() admin: any
  ) {
    return this.service.withdrawInterestBulk({
      withdrawals: body.withdrawals,
      bsDate: body.bs_date,
      createdBy: admin.id
    });
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MEMBER)
  async getAll(@Query() filters: any) {
    return this.service.getAll(filters);
  }
}
