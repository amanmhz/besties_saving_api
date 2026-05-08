import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManualTransactionsService } from './manual-transactions.service';
import { ManualTransactionsController } from './manual-transactions.controller';
import { ManualTransactionGroup } from '../../database/entities/manual-transaction-group.entity';
import { Transaction } from '../../database/entities/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ManualTransactionGroup, Transaction])],
  controllers: [ManualTransactionsController],
  providers: [ManualTransactionsService],
  exports: [ManualTransactionsService],
})
export class ManualTransactionsModule {}
