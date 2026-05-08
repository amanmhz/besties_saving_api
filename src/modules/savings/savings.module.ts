import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsService } from './savings.service';
import { SavingsController } from './savings.controller';
import { SavingAccount } from '../../database/entities/saving-account.entity';
import { SavingDeposit } from '../../database/entities/saving-deposit.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SavingAccount, SavingDeposit, Transaction, ActivityLog])],
  controllers: [SavingsController],
  providers: [SavingsService],
  exports: [SavingsService]
})
export class SavingsModule {}
