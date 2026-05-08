import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './user.entity';

export enum LoanStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  DEFAULTED = 'DEFAULTED',
}

@Entity('loan_accounts')
export class LoanAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  member_id: string;

  @ManyToOne(() => User, (user) => user.loanAccounts)
  @JoinColumn({ name: 'member_id' })
  user: User;

  @Column('decimal', { precision: 12, scale: 2 })
  principal_amount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  remaining_amount: number;

  @Column('decimal', { precision: 5, scale: 2 })
  interest_rate: number;

  @Column({ type: 'enum', enum: LoanStatus, default: LoanStatus.ACTIVE })
  status: LoanStatus;

  @Column({ type: 'date' })
  disbursed_ad_date: Date;

  @Column({ length: 10 })
  disbursed_bs_date: string;

  @Column({ length: 10 })
  fiscal_year: string;

  @Column({ length: 2 })
  fiscal_quarter: string;

  @Column('uuid')
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column('uuid', { nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
