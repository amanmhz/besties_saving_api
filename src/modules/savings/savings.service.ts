import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SavingAccount } from '../../database/entities/saving-account.entity';
import { SavingDeposit } from '../../database/entities/saving-deposit.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
import { ActivityLog, ActionType } from '../../database/entities/activity-log.entity';
import { DateConverter } from '../../common/utils/date-converter.util';
import { FiscalCalculator } from '../../common/utils/fiscal-calculator.util';

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(SavingAccount)
    private savingsRepo: Repository<SavingAccount>,
    @InjectRepository(SavingDeposit)
    private depositRepo: Repository<SavingDeposit>,
    private dataSource: DataSource,
  ) {}

  private async getOrgCurrentBalance(manager: any): Promise<number> {
    const cashFlow = await manager.createQueryBuilder(Transaction, 'tx')
      .select('SUM(tx.amount_in)', 'totalIn')
      .addSelect('SUM(tx.amount_out)', 'totalOut')
      .getRawOne();
    
    return parseFloat(cashFlow?.totalIn || '0') - parseFloat(cashFlow?.totalOut || '0');
  }

  async createAccount(memberId: string) {
    const existing = await this.savingsRepo.findOne({ where: { member_id: memberId } });
    if (existing) throw new BadRequestException('Saving account already exists for this member');
    
    const account = this.savingsRepo.create({ member_id: memberId, total_balance: 0 });
    return this.savingsRepo.save(account);
  }

  async deposit(memberId: string, amount: number, bsDate: string, createdBy: string) {
    if (amount <= 0) throw new BadRequestException('Deposit amount must be positive');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let account = await queryRunner.manager.findOne(SavingAccount, { where: { member_id: memberId } });
      if (!account) {
        account = queryRunner.manager.create(SavingAccount, { member_id: memberId, total_balance: 0 });
        account = await queryRunner.manager.save(account);
      }

      const adDate = DateConverter.bsToAd(bsDate);
      const fiscalYear = FiscalCalculator.getFiscalYear(bsDate);
      const fiscalQuarter = FiscalCalculator.getFiscalQuarter(bsDate);

      // 1. Update member master balance
      const oldBalance = Number(account.total_balance);
      account.total_balance = oldBalance + Number(amount);
      await queryRunner.manager.save(account);

      // 2. Create detailed deposit record (Member's history)
      const deposit = queryRunner.manager.create(SavingDeposit, {
        saving_account_id: account.id,
        amount,
        balance_after: account.total_balance,
        bs_date: bsDate,
        ad_date: adDate,
        created_by: createdBy
      });
      const savedDeposit = await queryRunner.manager.save(deposit);

      // 3. Organization Balance Tracking
      const currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);
      const newOrgBalance = currentOrgBalance + Number(amount);

      // 4. Create linked transaction for ledger (Org's cashflow)
      const transaction = queryRunner.manager.create(Transaction, {
        member_id: memberId,
        account_id: account.id,
        saving_account_id: account.id,
        saving_deposit_id: savedDeposit.id,
        type: TransactionType.SAVING_DEPOSIT,
        amount_in: amount,
        amount_out: 0,
        balance_amount: newOrgBalance, // Global Org Balance
        ad_date: adDate,
        bs_date: bsDate,
        fiscal_year: fiscalYear,
        fiscal_quarter: fiscalQuarter,
        created_by: createdBy,
        is_manual: false
      });
      await queryRunner.manager.save(transaction);

      // 5. Audit Log
      const log = queryRunner.manager.create(ActivityLog, {
        user_id: createdBy,
        action: ActionType.CREATE,
        module: 'SAVINGS',
        payload: { depositId: savedDeposit.id, amount, accountId: account.id }
      });
      await queryRunner.manager.save(log);

      await queryRunner.commitTransaction();
      return { account, deposit: savedDeposit };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getAllDeposits(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.depositRepo.findAndCount({
      relations: ['savingAccount', 'savingAccount.user', 'creator'],
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

  async getAccountByMember(memberId: string) {
    const account = await this.savingsRepo.findOne({ where: { member_id: memberId } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }
}
