import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';

@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async getAllTransactions(
    @Query('member_id') member_id?: string,
    @Query('fiscal_year') fiscal_year?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.transactionsService.findAll({ 
      member_id, 
      fiscal_year, 
      type,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10
    });
  }

  @Get('my-transactions')
  async getMyTransactions(@CurrentUser() user: any) {
    return this.transactionsService.getMyTransactions(user.id);
  }
}
