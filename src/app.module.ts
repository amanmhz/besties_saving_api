import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SavingsModule } from './modules/savings/savings.module';
import { LoansModule } from './modules/loans/loans.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { ManualTransactionsModule } from './modules/manual-transactions/manual-transactions.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SavingsInterestModule } from './modules/savings-interest/savings-interest.module';

import { User } from './database/entities/user.entity';
import { SavingAccount } from './database/entities/saving-account.entity';
import { LoanAccount } from './database/entities/loan-account.entity';
import { Transaction } from './database/entities/transaction.entity';
import { ManualTransactionGroup } from './database/entities/manual-transaction-group.entity';
import { SystemSetting } from './database/entities/system-setting.entity';
import { ActivityLog } from './database/entities/activity-log.entity';
import { LoanPayment } from './database/entities/loan-payment.entity';
import { SavingDeposit } from './database/entities/saving-deposit.entity';
import { SavingInterest } from './database/entities/saving-interest.entity';
import { ActivityLogsModule } from './modules/activity-logs/activity-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [User, SavingAccount, LoanAccount, Transaction, ManualTransactionGroup, SystemSetting, ActivityLog, LoanPayment, SavingDeposit, SavingInterest],
      synchronize: true, // Use carefully in production!
    }),
    AuthModule,
    UsersModule,
    SavingsModule,
    LoansModule,
    TransactionsModule,
    ManualTransactionsModule,
    SettingsModule,
    ReportsModule,
    ActivityLogsModule,
    SavingsInterestModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
