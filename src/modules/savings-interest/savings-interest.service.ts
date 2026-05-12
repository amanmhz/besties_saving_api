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
        const depositId = await this.internalDepositFromInterest(queryRunner.manager, memberId, amount, bsDate, createdBy, remarks);
        interest.saving_deposit_id = depositId;
        await queryRunner.manager.save(interest);
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
    return savedDeposit.id;
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
        const savedInterest = await queryRunner.manager.save(interest);

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
          const result = await this.internalDepositFromInterestWithBalance(queryRunner.manager, memberId, amount, bsDate, createdBy, remarks, currentOrgBalance);
          currentOrgBalance = result.newOrgBalance;
          savedInterest.saving_deposit_id = result.depositId;
          await queryRunner.manager.save(savedInterest);
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
    return { newOrgBalance, depositId: savedDeposit.id };
  }

  async getAll(filters: any) {
    const query = this.interestRepo.createQueryBuilder('interest')
      .leftJoinAndSelect('interest.creator', 'creator')
      .orderBy('interest.sn', 'DESC');
    
    // Add filters if needed
    return query.getMany();
  }

  async reverseInterest(id: string, createdBy: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const interestLog = await queryRunner.manager.findOne(SavingInterest, { where: { id } });
      if (!interestLog) throw new NotFoundException('Interest record not found');
      if (interestLog.is_reversed) throw new BadRequestException('Record is already reversed');

      interestLog.is_reversed = true;
      await queryRunner.manager.save(interestLog);

      let currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);
      const adDate = new Date();
      const bs_date = DateConverter.adToBs(adDate);
      const fiscalYear = FiscalCalculator.getFiscalYear(bs_date);
      const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bs_date);

      const lastRecord = await queryRunner.manager.findOne(SavingInterest, {
        where: {},
        order: { sn: 'DESC' }
      });
      let currentPoolBalance = lastRecord ? Number(lastRecord.balance_amount) : 0;

      if (Number(interestLog.amount_in) > 0) {
        // Reversing an ADD (bank interest)
        currentPoolBalance -= Number(interestLog.amount_in);
        const reversalInterest = queryRunner.manager.create(SavingInterest, {
          amount_in: 0,
          amount_out: interestLog.amount_in,
          balance_amount: currentPoolBalance,
          withdraw_type: 'REVERSAL',
          remarks: `Reversal of bank interest add (Ref: ${interestLog.id})`,
          ad_date: adDate,
          bs_date: bs_date,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          is_reversed: true // Optional: Mark the reversal row itself as reversed or just let it act as an adjusting entry
        });
        await queryRunner.manager.save(reversalInterest);

        currentOrgBalance -= Number(interestLog.amount_in);
        const transaction = queryRunner.manager.create(Transaction, {
          type: TransactionType.SAVING_INTEREST_ADD_REVERSAL,
          amount_in: 0,
          amount_out: interestLog.amount_in,
          balance_amount: currentOrgBalance,
          ad_date: adDate,
          bs_date: bs_date,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          description: `Reversal of bank interest add (ID: ${interestLog.id})`,
          is_manual: true
        });
        await queryRunner.manager.save(transaction);
      } else if (Number(interestLog.amount_out) > 0) {
        // Reversing a DISTRIBUTION
        currentPoolBalance += Number(interestLog.amount_out);
        const reversalInterest = queryRunner.manager.create(SavingInterest, {
          amount_in: interestLog.amount_out,
          amount_out: 0,
          balance_amount: currentPoolBalance,
          remarks: `Reversal of interest distribution (Ref: ${interestLog.id})`,
          ad_date: adDate,
          bs_date: bs_date,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          is_reversed: true
        });
        await queryRunner.manager.save(reversalInterest);

        currentOrgBalance += Number(interestLog.amount_out);
        const transaction = queryRunner.manager.create(Transaction, {
          type: TransactionType.SAVING_INTEREST_DISTRIBUTION_REVERSAL,
          amount_in: interestLog.amount_out,
          amount_out: 0,
          balance_amount: currentOrgBalance,
          ad_date: adDate,
          bs_date: bs_date,
          fiscal_year: fiscalYear,
          fiscal_quarter: fiscalQuarter,
          created_by: createdBy,
          description: `Reversal of interest distribution (ID: ${interestLog.id})`,
          is_manual: true
        });
        await queryRunner.manager.save(transaction);

        // If it was a transfer, we must also reverse the saving deposit
        if (interestLog.withdraw_type === 'TRANSFER_TO_SAVING_ACCOUNT' && interestLog.saving_deposit_id) {
          const originalDeposit = await queryRunner.manager.findOne(SavingDeposit, { 
            where: { id: interestLog.saving_deposit_id }
          });
          
          if (originalDeposit) {
            const account = await queryRunner.manager.findOne(SavingAccount, { 
              where: { id: originalDeposit.saving_account_id }
            });
            
            if (account) {
              account.total_balance = Number(account.total_balance) - Number(interestLog.amount_out);
              await queryRunner.manager.save(account);

              const reversalDeposit = queryRunner.manager.create(SavingDeposit, {
                saving_account_id: account.id,
                amount_in: 0,
                amount_out: interestLog.amount_out,
                withdraw_type: 'REVERSAL',
                remarks: `Reversing accidental interest transfer (Ref: ${interestLog.id})`,
                balance_after: account.total_balance,
                bs_date: bs_date,
                ad_date: adDate,
                fiscal_year: fiscalYear,
                fiscal_quarter: fiscalQuarter,
                created_by: createdBy
              });
              const savedReversalDeposit = await queryRunner.manager.save(reversalDeposit);

              currentOrgBalance -= Number(interestLog.amount_out);
              const tx2 = queryRunner.manager.create(Transaction, {
                account_id: account.id,
                saving_account_id: account.id,
                saving_deposit_id: savedReversalDeposit.id,
                type: TransactionType.SAVING_WITHDRAW,
                amount_in: 0,
                amount_out: interestLog.amount_out,
                balance_amount: currentOrgBalance,
                ad_date: adDate,
                bs_date: bs_date,
                fiscal_year: fiscalYear,
                fiscal_quarter: fiscalQuarter,
                created_by: createdBy,
                description: `Reversal of interest transfer deposit`,
                is_manual: false
              });
              await queryRunner.manager.save(tx2);
            }
          }
        }
      }

      await queryRunner.commitTransaction();
      return { message: 'Interest record reversed successfully' };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}
