import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SavingsInterestService } from './savings-interest.service';
import { SavingsInterestController } from './savings-interest.controller';
import { SavingInterest } from '../../database/entities/saving-interest.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { ActivityLog } from '../../database/entities/activity-log.entity';
import { SavingsModule } from '../savings/savings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SavingInterest, Transaction, ActivityLog]),
    SavingsModule,
  ],
  controllers: [SavingsInterestController],
  providers: [SavingsInterestService],
})
export class SavingsInterestModule {}
