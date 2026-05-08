import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { LoanAccount, LoanStatus } from '../../database/entities/loan-account.entity';
import { LoanPayment } from '../../database/entities/loan-payment.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
import { ActivityLog, ActionType } from '../../database/entities/activity-log.entity';
import { DateConverter } from '../../common/utils/date-converter.util';
import { FiscalCalculator } from '../../common/utils/fiscal-calculator.util';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(LoanAccount)
    private loansRepo: Repository<LoanAccount>,
    @InjectRepository(LoanPayment)
    private paymentsRepo: Repository<LoanPayment>,
    private dataSource: DataSource,
  ) {}

  private async getOrgCurrentBalance(manager: any): Promise<number> {
    const cashFlow = await manager.createQueryBuilder(Transaction, 'tx')
      .select('SUM(tx.amount_in)', 'totalIn')
      .addSelect('SUM(tx.amount_out)', 'totalOut')
      .getRawOne();
    
    return parseFloat(cashFlow?.totalIn || '0') - parseFloat(cashFlow?.totalOut || '0');
  }

  async disburseLoan(memberId: string, principal: number, interestRate: number, bsDate: string, createdBy: string) {
    if (principal <= 0) throw new BadRequestException('Principal must be positive');

    const adDate = DateConverter.bsToAd(bsDate);
    const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
    const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const loan = queryRunner.manager.create(LoanAccount, {
        member_id: memberId,
        principal_amount: principal,
        remaining_amount: principal,
        interest_rate: interestRate,
        status: LoanStatus.ACTIVE,
        disbursed_ad_date: adDate,
        disbursed_bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy
      });

      const savedLoan = await queryRunner.manager.save(loan);

      // Organization Balance Tracking
      const currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);
      const newOrgBalance = currentOrgBalance - principal;

      // Create Disbursement Transaction (Money going out)
      const transaction = queryRunner.manager.create(Transaction, {
        member_id: memberId,
        account_id: savedLoan.id,
        loan_account_id: savedLoan.id,
        type: TransactionType.LOAN_DISBURSEMENT,
        amount_in: 0,
        amount_out: principal,
        balance_amount: newOrgBalance, // Org cash after disbursement
        ad_date: adDate,
        bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy,
        is_manual: false
      });
      await queryRunner.manager.save(transaction);

      const log = queryRunner.manager.create(ActivityLog, {
        user_id: createdBy,
        action: ActionType.CREATE,
        module: 'LOANS',
        payload: { loanId: savedLoan.id, memberId, amount: principal }
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return savedLoan;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async repayLoan(loanId: string, payload: { amount_paid: number, interest_paid: number, bs_date: string }, createdBy: string) {
    const { amount_paid, interest_paid, bs_date } = payload;
    const total_paid = Number(amount_paid) + Number(interest_paid);
    if (total_paid <= 0) throw new BadRequestException('Total payment must be positive');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const loan = await queryRunner.manager.findOne(LoanAccount, { where: { id: loanId } });
      if (!loan) throw new NotFoundException('Loan not found');
      if (loan.status === LoanStatus.CLOSED) throw new BadRequestException('Loan is already closed');

      const adDate = DateConverter.bsToAd(bs_date);
      const fiscalYear = FiscalCalculator.getFiscalYear(bs_date);
      const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bs_date);

      // 1. Update Loan Account
      const oldRemaining = Number(loan.remaining_amount);
      loan.remaining_amount = oldRemaining - Number(amount_paid);
      loan.updated_by = createdBy;
      if (loan.remaining_amount <= 0) {
        loan.remaining_amount = 0;
        loan.status = LoanStatus.CLOSED;
      }
      const updatedLoan = await queryRunner.manager.save(loan);

      // 2. Create Payment Record
      const payment = queryRunner.manager.create(LoanPayment, {
        loan_account_id: loan.id,
        amount_paid,
        interest_paid,
        total_paid,
        remaining_amount: updatedLoan.remaining_amount,
        payment_date: adDate,
        created_by: createdBy
      });
      const savedPayment = await queryRunner.manager.save(payment);

      // 3. Organization Balance Tracking
      let currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);

      // Row 1: Principal Payment
      if (Number(amount_paid) > 0) {
        currentOrgBalance += Number(amount_paid);
        const principalTx = queryRunner.manager.create(Transaction, {
          member_id: loan.member_id,
          account_id: loan.id,
          loan_account_id: loan.id,
          loan_payment_id: savedPayment.id,
          type: TransactionType.LOAN_REPAYMENT,
          amount_in: amount_paid,
          amount_out: 0,
          balance_amount: currentOrgBalance,
          ad_date: adDate,
          bs_date: bs_date,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          is_manual: false
        });
        await queryRunner.manager.save(principalTx);
      }

      // Row 2: Interest Payment
      if (Number(interest_paid) > 0) {
        currentOrgBalance += Number(interest_paid);
        const interestTx = queryRunner.manager.create(Transaction, {
          member_id: loan.member_id,
          account_id: loan.id,
          loan_account_id: loan.id,
          loan_payment_id: savedPayment.id,
          type: TransactionType.LOAN_INTEREST_PAYMENT,
          amount_in: interest_paid,
          amount_out: 0,
          balance_amount: currentOrgBalance,
          ad_date: adDate,
          bs_date: bs_date,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          is_manual: false
        });
        await queryRunner.manager.save(interestTx);
      }

      // 4. Audit Log
      const log = queryRunner.manager.create(ActivityLog, {
        user_id: createdBy,
        action: ActionType.UPDATE,
        module: 'LOANS',
        payload: { paymentId: savedPayment.id, loanId, amount_paid, interest_paid }
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return { loan: updatedLoan, payment: savedPayment };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getLoansByMember(memberId: string) {
    return this.loansRepo.find({ where: { member_id: memberId }, order: { created_at: 'DESC' } });
  }

  async getAllLoans(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.loansRepo.findAndCount({ 
      relations: ['user', 'creator'],
      order: { created_at: 'DESC' },
      take: limit,
      skip: skip
    });

    return {
      data,
      total,
      page,
      limit
    };
  }

  async getLoanWithPayments(loanId: string) {
    const loan = await this.loansRepo.findOne({
      where: { id: loanId },
      relations: ['user']
    });

    if (!loan) throw new NotFoundException('Loan not found');

    const payments = await this.paymentsRepo.find({
      where: { loan_account_id: loanId },
      order: { payment_date: 'DESC', created_at: 'DESC' },
      relations: ['creator']
    });

    return { ...loan, payments };
  }
}
