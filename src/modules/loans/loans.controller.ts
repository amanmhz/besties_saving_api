import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';

@Controller('loans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post(':memberId/disburse')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async disburse(
    @Param('memberId') memberId: string,
    @Body() body: { principal: number, interest_rate: number, bs_date: string },
    @CurrentUser() admin: any
  ) {
    return this.loansService.disburseLoan(memberId, body.principal, body.interest_rate, body.bs_date, admin.id);
  }

  @Post(':loanId/repay')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async repay(
    @Param('loanId') loanId: string,
    @Body() body: { amount_paid: number, interest_paid: number, bs_date: string },
    @CurrentUser() admin: any
  ) {
    return this.loansService.repayLoan(loanId, body, admin.id);
  }

  @Get('my-loans')
  async getMyLoans(@CurrentUser() user: any) {
    return this.loansService.getLoansByMember(user.id);
  }

  @Get(':loanId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getLoan(@Param('loanId') loanId: string) {
    return this.loansService.getLoanWithPayments(loanId);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getAllLoans(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loansService.getAllLoans(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }
}
