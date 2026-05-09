import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SavingInterest } from '../../database/entities/saving-interest.entity';
import { SavingAccount } from '../../database/entities/saving-account.entity';
import { SavingDeposit } from '../../database/entities/saving-deposit.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
import { ActivityLog, ActionType } from '../../database/entities/activity-log.entity';
import { DateConverter } from '../../common/utils/date-converter.util';
import { FiscalCalculator } from '../../common/utils/fiscal-calculator.util';
import { SavingsService } from '../savings/savings.service';

@Injectable()
export class SavingsInterestService {
  constructor(
    @InjectRepository(SavingInterest)
    private interestRepo: Repository<SavingInterest>,
    private dataSource: DataSource,
    private savingsService: SavingsService,
  ) {}

  private async getOrgCurrentBalance(manager: any): Promise<number> {
    const cashFlow = await manager.createQueryBuilder(Transaction, 'tx')
      .select('SUM(tx.amount_in)', 'totalIn')
      .addSelect('SUM(tx.amount_out)', 'totalOut')
      .getRawOne();
    
    return parseFloat(cashFlow?.totalIn || '0') - parseFloat(cashFlow?.totalOut || '0');
  }

  async addInterest(amount: number, bsDate: string, createdBy: string, remarks: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const adDate = DateConverter.bsToAd(bsDate);
      const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
      const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

      const lastRecord = await queryRunner.manager.findOne(SavingInterest, {
        where: {},
        order: { sn: 'DESC' }
      });
      const oldBalance = lastRecord ? Number(lastRecord.balance_amount) : 0;
      const newBalance = oldBalance + Number(amount);

      const interest = queryRunner.manager.create(SavingInterest, {
        amount_in: amount,
        amount_out: 0,
        balance_amount: newBalance,
        remarks,
        ad_date: adDate,
        bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy
      });
      const savedInterest = await queryRunner.manager.save(interest);

      const currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);
      const newOrgBalance = currentOrgBalance + Number(amount);

      const transaction = queryRunner.manager.create(Transaction, {
        type: TransactionType.SAVING_INTEREST,
        amount_in: amount,
        amount_out: 0,
        balance_amount: newOrgBalance,
        ad_date: adDate,
        bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy,
        description: remarks,
        is_manual: true
      });
      await queryRunner.manager.save(transaction);

      await queryRunner.commitTransaction();
      return savedInterest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async withdrawInterest(memberId: string, amount: number, bsDate: string, createdBy: string, withdrawType: string, remarks: string) {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lastRecord = await queryRunner.manager.findOne(SavingInterest, {
        where: {},
        order: { sn: 'DESC' }
      });
      const oldBalance = lastRecord ? Number(lastRecord.balance_amount) : 0;
      if (oldBalance < amount) throw new BadRequestException('Insufficient interest pool balance');

      const adDate = DateConverter.bsToAd(bsDate);
      const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
      const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

      const newBalance = oldBalance - Number(amount);

      const interest = queryRunner.manager.create(SavingInterest, {
        amount_in: 0,
        amount_out: amount,
        balance_amount: newBalance,
        withdraw_type: withdrawType,
        remarks,
        ad_date: adDate,
        bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy
      });
      const savedInterest = await queryRunner.manager.save(interest);

      const currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);
      const newOrgBalance = currentOrgBalance - Number(amount);

      const transaction = queryRunner.manager.create(Transaction, {
        member_id: memberId,
        type: TransactionType.SAVING_INTEREST,
        amount_in: 0,
        amount_out: amount,
        balance_amount: newOrgBalance,
        ad_date: adDate,
        bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy,
        description: `Interest Withdrawal: ${remarks}`,
        is_manual: true
      });
      await queryRunner.manager.save(transaction);

      if (withdrawType === 'TRANSFER_TO_SAVING_ACCOUNT') {
        // We need to perform the deposit. 
        // Note: Using the savingsService within the same transaction if possible, 
        // but since we are already in a transaction, we should use queryRunner.manager.
        
        // Let's call a internal helper or just re-implement deposit logic here to ensure same transaction
        await this.internalDepositFromInterest(queryRunner.manager, memberId, amount, bsDate, createdBy, remarks);
      }

      await queryRunner.commitTransaction();
      return savedInterest;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async internalDepositFromInterest(manager: any, memberId: string, amount: number, bsDate: string, createdBy: string, remarks: string) {


    let account = await manager.findOne(SavingAccount, { where: { member_id: memberId } });
    if (!account) {
      account = manager.create(SavingAccount, { member_id: memberId, total_balance: 0 });
      account = await manager.save(account);
    }

    const adDate = DateConverter.bsToAd(bsDate);
    const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
    const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

    const oldBalance = Number(account.total_balance);
    account.total_balance = oldBalance + Number(amount);
    await manager.save(account);

    const deposit = manager.create(SavingDeposit, {
      saving_account_id: account.id,
      amount_in: amount,
      amount_out: 0,
      deposit_type: 'FROM_INTEREST',
      remarks: remarks || 'Transfer from Interest',
      balance_after: account.total_balance,
      bs_date: bsDate,
      ad_date: adDate,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      created_by: createdBy
    });
    const savedDeposit = await manager.save(deposit);

    const currentOrgBalance = await this.getOrgCurrentBalance(manager);
    const newOrgBalance = currentOrgBalance + Number(amount);

    const transaction = manager.create(Transaction, {
      member_id: memberId,
      account_id: account.id,
      saving_account_id: account.id,
      saving_deposit_id: savedDeposit.id,
      type: TransactionType.SAVING_DEPOSIT,
      amount_in: amount,
      amount_out: 0,
      balance_amount: newOrgBalance,
      ad_date: adDate,
      bs_date: bsDate,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      created_by: createdBy,
      description: `Deposit from Interest: ${remarks}`,
      is_manual: false
    });
    await manager.save(transaction);
  }

  async withdrawInterestBulk(data: {
    withdrawals: { memberId: string; amount: number; withdrawType: string; remarks: string }[];
    bsDate: string;
    createdBy: string;
  }) {
    const { withdrawals, bsDate, createdBy } = data;
    const totalAmount = withdrawals.reduce((sum, w) => sum + Number(w.amount || 0), 0);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lastRecord = await queryRunner.manager.findOne(SavingInterest, {
        where: {},
        order: { sn: 'DESC' }
      });
      const poolBalance = lastRecord ? Number(lastRecord.balance_amount) : 0;
      if (poolBalance < totalAmount) {
        throw new BadRequestException(`Insufficient interest pool balance. Required: Rs. ${totalAmount}, Available: Rs. ${poolBalance}`);
      }

      let currentPoolBalance = poolBalance;
      let currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);

      const adDate = DateConverter.bsToAd(bsDate);
      const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
      const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

      for (const w of withdrawals) {
        const { memberId, amount: rawAmount, withdrawType, remarks } = w;
        const amount = Number(rawAmount);
        if (amount <= 0) continue;

        currentPoolBalance -= amount;
        
        const interest = queryRunner.manager.create(SavingInterest, {
          amount_in: 0,
          amount_out: amount,
          balance_amount: currentPoolBalance,
          withdraw_type: withdrawType,
          remarks: remarks,
          ad_date: adDate,
          bs_date: bsDate,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy
        });
        await queryRunner.manager.save(interest);

        // Org level transaction (Distribution)
        currentOrgBalance -= amount;
        const transaction = queryRunner.manager.create(Transaction, {
          member_id: memberId,
          type: TransactionType.SAVING_INTEREST,
          amount_in: 0,
          amount_out: amount,
          balance_amount: currentOrgBalance,
          ad_date: adDate,
          bs_date: bsDate,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          description: `Interest Withdrawal: ${remarks}`,
          is_manual: true
        });
        await queryRunner.manager.save(transaction);

        if (withdrawType === 'TRANSFER_TO_SAVING_ACCOUNT') {
          // Inside internalDepositFromInterest, we need to pass the currentOrgBalance and get back the updated one
          // to avoid multiple SUM queries. But for now, let's keep it simple or refactor internalDeposit.
          // Let's refactor it slightly to accept org balance.
          currentOrgBalance = await this.internalDepositFromInterestWithBalance(queryRunner.manager, memberId, amount, bsDate, createdBy, remarks, currentOrgBalance);
        }
      }

      await queryRunner.commitTransaction();
      return { success: true, count: withdrawals.length };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  private async internalDepositFromInterestWithBalance(manager: any, memberId: string, amount: number, bsDate: string, createdBy: string, remarks: string, currentOrgBalance: number) {
    let account = await manager.findOne(SavingAccount, { where: { member_id: memberId } });
    if (!account) {
      account = manager.create(SavingAccount, { member_id: memberId, total_balance: 0 });
      account = await manager.save(account);
    }

    const adDate = DateConverter.bsToAd(bsDate);
    const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
    const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

    const oldBalance = Number(account.total_balance);
    account.total_balance = oldBalance + Number(amount);
    await manager.save(account);

    const deposit = manager.create(SavingDeposit, {
      saving_account_id: account.id,
      amount_in: amount,
      amount_out: 0,
      deposit_type: 'FROM_INTEREST',
      remarks: remarks || 'Transfer from Interest',
      balance_after: account.total_balance,
      bs_date: bsDate,
      ad_date: adDate,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      created_by: createdBy
    });
    const savedDeposit = await manager.save(deposit);

    const newOrgBalance = currentOrgBalance + Number(amount);

    const transaction = manager.create(Transaction, {
      member_id: memberId,
      account_id: account.id,
      saving_account_id: account.id,
      saving_deposit_id: savedDeposit.id,
      type: TransactionType.SAVING_DEPOSIT,
      amount_in: amount,
      amount_out: 0,
      balance_amount: newOrgBalance,
      ad_date: adDate,
      bs_date: bsDate,
      fiscal_year: fiscalYear,
      fiscal_quarter: fiscalQuarter,
      created_by: createdBy,
      description: `Deposit from Interest: ${remarks}`,
      is_manual: false
    });
    await manager.save(transaction);
    return newOrgBalance;
  }

  async getAll(filters: any) {
    const query = this.interestRepo.createQueryBuilder('interest')
      .leftJoinAndSelect('interest.creator', 'creator')
      .orderBy('interest.sn', 'DESC');
    
    // Add filters if needed
    return query.getMany();
  }
}
