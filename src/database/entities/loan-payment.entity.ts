import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LoanAccount } from './loan-account.entity';
import { User } from './user.entity';

@Entity('loan_payments')
export class LoanPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', generated: 'increment', unique: true })
  sn: number;

  @Column('uuid')
  loan_account_id: string;

  @ManyToOne(() => LoanAccount)
  @JoinColumn({ name: 'loan_account_id' })
  loanAccount: LoanAccount;

  @Column('decimal', { precision: 12, scale: 2 })
  amount_paid: number;

  @Column('decimal', { precision: 12, scale: 2 })
  interest_paid: number;

  @Column('decimal', { precision: 12, scale: 2 })
  total_paid: number;

  @Column('decimal', { precision: 12, scale: 2 })
  remaining_amount: number;

  @Column({ type: 'date' })
  payment_date: Date;

  @Column({ default: false })
  is_reversed: boolean;

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
