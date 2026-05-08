import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ManualTransactionsService } from './manual-transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../../database/entities/user.entity';

@Controller('manual-transactions')
@UseGuards(JwtAuthGuard)
export class ManualTransactionsController {
  constructor(private readonly manualTransactionsService: ManualTransactionsService) {}

  @Post('batch')
  async createBatch(
    @Body() payload: any, // In production, use a DTO
    @CurrentUser() user: User
  ) {
    return this.manualTransactionsService.createBatch({
      ...payload,
      created_by: user.id
    });
  }

  @Get('groups')
  async findAllGroups() {
    return this.manualTransactionsService.findAllGroups();
  }
}
