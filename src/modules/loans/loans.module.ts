import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansService } from './loans.service';
import { LoansController } from './loans.controller';
import { LoanAccount } from '../../database/entities/loan-account.entity';
import { LoanPayment } from '../../database/entities/loan-payment.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LoanAccount, LoanPayment, Transaction, ActivityLog])],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService]
})
export class LoansModule {}
