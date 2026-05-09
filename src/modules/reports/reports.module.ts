import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { SavingAccount } from '../../database/entities/saving-account.entity';
import { LoanAccount } from '../../database/entities/loan-account.entity';
import { User } from '../../database/entities/user.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { SavingInterest } from '../../database/entities/saving-interest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavingAccount, LoanAccount, User, Transaction, SavingInterest])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
