import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ManualGroupStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
}

@Entity('manual_transaction_groups')
export class ManualTransactionGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  description: string;

  @Column({ type: 'date' })
  ad_date: Date;

  @Column({ length: 10 })
  bs_date: string;

  @Column({ length: 10 })
  fiscal_year: string;

  @Column({ length: 2 })
  fiscal_quarter: string;

  @Column({ type: 'enum', enum: ManualGroupStatus, default: ManualGroupStatus.PENDING })
  status: ManualGroupStatus;

  @Column('uuid')
  created_by: string;

  @CreateDateColumn()
  created_at: Date;
}
