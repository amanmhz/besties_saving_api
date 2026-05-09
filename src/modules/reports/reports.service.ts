import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavingAccount } from '../../database/entities/saving-account.entity';
import { LoanAccount, LoanStatus } from '../../database/entities/loan-account.entity';
import { User } from '../../database/entities/user.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
import { SavingInterest } from '../../database/entities/saving-interest.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SavingAccount)
    private readonly savingRepo: Repository<SavingAccount>,
    @InjectRepository(LoanAccount)
    private readonly loanRepo: Repository<LoanAccount>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(SavingInterest)
    private readonly interestRepo: Repository<SavingInterest>,
  ) {}

  async getDashboardStats() {
    const [totalSavings, activeLoans, totalMembers, cashFlow, loanInterest, bankInterest, bankInterestPool] = await Promise.all([
      this.savingRepo
        .createQueryBuilder('sa')
        .select('SUM(sa.total_balance)', 'sum')
        .getRawOne(),
      this.loanRepo
        .createQueryBuilder('la')
        .select('SUM(la.remaining_amount)', 'sum')
        .where('la.status = :status', { status: LoanStatus.ACTIVE })
        .getRawOne(),
      this.userRepo.count(),
      this.transactionRepo
        .createQueryBuilder('tx')
        .select('SUM(tx.amount_in)', 'totalIn')
        .addSelect('SUM(tx.amount_out)', 'totalOut')
        .getRawOne(),
      this.transactionRepo
        .createQueryBuilder('tx')
        .select('SUM(tx.amount_in)', 'sum')
        .where('tx.type = :type', { type: TransactionType.LOAN_INTEREST_PAYMENT })
        .getRawOne(),
      this.transactionRepo
        .createQueryBuilder('tx')
        .select('SUM(tx.amount_in)', 'sum')
        .where('tx.type = :type', { type: TransactionType.SAVING_INTEREST })
        .getRawOne(),
      this.interestRepo
        .createQueryBuilder('si')
        .select('si.balance_amount', 'balance')
        .orderBy('si.sn', 'DESC')
        .limit(1)
        .getRawOne(),
    ]);

    const totalIn = parseFloat(cashFlow?.totalIn || '0');
    const totalOut = parseFloat(cashFlow?.totalOut || '0');
    const availableBalance = totalIn - totalOut;

    // Get Organization Balance Over Time for Chart (Last 30 entries/days)
    // We fetch the latest balance_amount for each date
    const balanceData = await this.transactionRepo
      .createQueryBuilder('tx')
      .select('tx.bs_date', 'date')
      .addSelect('MAX(tx.balance_amount)', 'balance') // Take the closing balance of that day
      .groupBy('tx.bs_date')
      .orderBy('tx.bs_date', 'ASC')
      .limit(30)
      .getRawMany();

    return {
      totalSavings: parseFloat(totalSavings?.sum || '0'),
      activeLoans: parseFloat(activeLoans?.sum || '0'),
      totalMembers,
      availableBalance,
      totalInterest: {
        loan: parseFloat(loanInterest?.sum || '0'),
        bank: parseFloat(bankInterest?.sum || '0'), 
        currentPoolBalance: parseFloat(bankInterestPool?.balance || '0'),
      },
      chartData: balanceData.map(d => ({
        date: d.date,
        balance: parseFloat(d.balance || '0'),
      }))
    };
  }
}
