import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ManualTransactionGroup, ManualGroupStatus } from '../../database/entities/manual-transaction-group.entity';
import { Transaction, TransactionType } from '../../database/entities/transaction.entity';
import { SavingAccount } from '../../database/entities/saving-account.entity';
import { LoanAccount, LoanStatus } from '../../database/entities/loan-account.entity';
import { DateConverter } from '../../common/utils/date-converter.util';
import { FiscalCalculator } from '../../common/utils/fiscal-calculator.util';

@Injectable()
export class ManualTransactionsService {
  constructor(
    @InjectRepository(ManualTransactionGroup)
    private readonly groupRepo: Repository<ManualTransactionGroup>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly dataSource: DataSource,
  ) {}

  private async getOrgCurrentBalance(manager: any): Promise<number> {
    const cashFlow = await manager.createQueryBuilder(Transaction, 'tx')
      .select('SUM(tx.amount_in)', 'totalIn')
      .addSelect('SUM(tx.amount_out)', 'totalOut')
      .getRawOne();
    
    return parseFloat(cashFlow?.totalIn || '0') - parseFloat(cashFlow?.totalOut || '0');
  }

  async createBatch(payload: {
    description: string;
    bs_date: string;
    created_by: string;
    items: {
      member_id: string;
      type: TransactionType;
      amount: number;
      reference?: string;
    }[];
  }) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const adDate = DateConverter.bsToAd(payload.bs_date);
      const fy = FiscalCalculator.getFiscalYear(payload.bs_date);
      const quarter = FiscalCalculator.getFiscalQuarter(payload.bs_date);

      // 1. Create Group (Independent calculation check)
      const group = this.groupRepo.create({
        description: payload.description,
        bs_date: payload.bs_date,
        ad_date: adDate,
        fiscal_year: fy,
        fiscal_quarter: quarter,
        status: ManualGroupStatus.RECONCILED,
        created_by: payload.created_by,
      });
      const savedGroup = await queryRunner.manager.save(group);

      // 2. Organization Balance Tracking Initialization
      let currentOrgBalance = await this.getOrgCurrentBalance(queryRunner.manager);

      // 3. Process Items and sync with cashflow tables
      for (const item of payload.items) {
        let accountId: string;
        let amountIn = 0;
        let amountOut = 0;

        if (item.type === TransactionType.SAVING_DEPOSIT) {
          let savingAccount = await queryRunner.manager.findOne(SavingAccount, { where: { member_id: item.member_id } });
          if (!savingAccount) {
            savingAccount = queryRunner.manager.create(SavingAccount, { member_id: item.member_id, total_balance: 0 });
            savingAccount = await queryRunner.manager.save(savingAccount);
          }
          savingAccount.total_balance = Number(savingAccount.total_balance) + Number(item.amount);
          await queryRunner.manager.save(savingAccount);
          
          accountId = savingAccount.id;
          amountIn = item.amount;
          currentOrgBalance += Number(item.amount);
        } else if (item.type === TransactionType.LOAN_REPAYMENT) {
          const loanAccount = await queryRunner.manager.findOne(LoanAccount, { 
            where: { member_id: item.member_id, status: LoanStatus.ACTIVE } 
          });
          if (!loanAccount) throw new Error(`No active loan found for member ${item.member_id}`);
          
          loanAccount.remaining_amount = Number(loanAccount.remaining_amount) - Number(item.amount);
          if (loanAccount.remaining_amount <= 0) {
            loanAccount.remaining_amount = 0;
            loanAccount.status = LoanStatus.CLOSED;
          }
          await queryRunner.manager.save(loanAccount);
          
          accountId = loanAccount.id;
          amountIn = item.amount;
          currentOrgBalance += Number(item.amount);
        } else {
            throw new Error(`Transaction type ${item.type} not supported in batch yet`);
        }

        const transaction = queryRunner.manager.create(Transaction, {
          member_id: item.member_id,
          account_id: accountId,
          type: item.type,
          amount_in: amountIn,
          amount_out: amountOut,
          balance_amount: currentOrgBalance, // Running Org Balance
          ad_date: adDate,
          bs_date: payload.bs_date,
          fiscal_year: fy,
          fiscal_quarter: quarter,
          is_manual: true,
          reference: item.reference || `Batch: ${savedGroup.id.slice(0,8)}`,
          description: payload.description,
          created_by: payload.created_by,
        });
        await queryRunner.manager.save(transaction);
      }

      await queryRunner.commitTransaction();
      return savedGroup;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async findAllGroups() {
    return this.groupRepo.find({ order: { created_at: 'DESC' } });
  }
}
