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
  constructor(private readonly loansService: LoansService) { }

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

  @Post(':loanId/payments/:paymentId/reverse')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async reversePayment(
    @Param('paymentId') paymentId: string,
    @CurrentUser() admin: any
  ) {
    return this.loansService.reversePayment(paymentId, admin.id);
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
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MEMBER)
  async getAllLoans(
    @Query('member_id') member_id?: string,
    @Query('created_by') created_by?: string,
    @Query('status') status?: string,
    @Query('fiscal_year') fiscal_year?: string,
    @Query('fiscal_quarter') fiscal_quarter?: string,
    @Query('date_from') date_from?: string,
    @Query('date_to') date_to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.loansService.getAllLoans({
      member_id,
      created_by,
      status,
      fiscal_year,
      fiscal_quarter,
      date_from,
      date_to,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10
    });
  }
}
