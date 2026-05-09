import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SavingAccount } from './saving-account.entity';
import { User } from './user.entity';

@Entity('saving_deposits')
export class SavingDeposit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment', unique: true })
  sn: number;

  @Column('uuid')
  saving_account_id: string;

  @ManyToOne(() => SavingAccount, (account) => account.deposits)
  @JoinColumn({ name: 'saving_account_id' })
  savingAccount: SavingAccount;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount_in: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount_out: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  deposit_type: string; // CASH, ONLINE, FROM_INTEREST

  @Column({ type: 'varchar', length: 50, nullable: true })
  withdraw_type: string; // CASH, ONLINE

  @Column({ type: 'text', nullable: true })
  remarks: string;

  @Column({ length: 10, nullable: true })
  fiscal_year: string;

  @Column({ length: 2, nullable: true })
  fiscal_quarter: string;

  @Column('decimal', { precision: 12, scale: 2 })
  balance_after: number;

  @Column({ type: 'date' })
  bs_date: string; // Storing as string for BS consistency, or Date for AD

  @Column({ type: 'date' })
  ad_date: Date;

  @Column('uuid')
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
