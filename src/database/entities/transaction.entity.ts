import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

export enum TransactionType {
  SAVING_DEPOSIT = 'SAVING_DEPOSIT',
  SAVING_WITHDRAW = 'SAVING_WITHDRAW',
  SAVING_INTEREST = 'SAVING_INTEREST',
  LOAN_REPAYMENT = 'LOAN_REPAYMENT',
  LOAN_INTEREST_PAYMENT = 'LOAN_INTEREST_PAYMENT',
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment', unique: true })
  sn: number;

  @Column('uuid', { nullable: true })
  member_id: string;

  @ManyToOne(() => User, (user) => user.transactions)
  @JoinColumn({ name: 'member_id' })
  user: User;

  @Column('uuid', { nullable: true })
  account_id: string; // References SavingAccount or LoanAccount

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount_in: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  amount_out: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  balance_amount: number; // Running balance (e.g. remaining loan or total savings)

  @Column('uuid', { nullable: true })
  saving_account_id: string;

  @Column('uuid', { nullable: true })
  loan_account_id: string;

  @Column('uuid', { nullable: true })
  loan_payment_id: string;

  @Column('uuid', { nullable: true })
  saving_deposit_id: string;

  @Column({ type: 'date' })
  ad_date: Date;

  @Column({ length: 10 })
  bs_date: string;

  @Column({ length: 10 })
  fiscal_year: string;

  @Column({ length: 2 })
  fiscal_quarter: string;

  @Column({ default: false })
  is_manual: boolean;

  @Column({ nullable: true, length: 100 })
  reference: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column('uuid')
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;
}
