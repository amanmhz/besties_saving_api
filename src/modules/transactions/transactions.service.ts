import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepo: Repository<Transaction>,
  ) {}

  async findAll(filters: { member_id?: string; fiscal_year?: string; type?: string; page?: number; limit?: number; }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query = this.transactionsRepo.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.user', 'user')
      .leftJoinAndSelect('transaction.creator', 'creator')
      .orderBy('transaction.created_at', 'DESC');

    if (filters.member_id) {
      query.andWhere('transaction.member_id = :memberId', { memberId: filters.member_id });
    }
    
    if (filters.fiscal_year) {
      query.andWhere('transaction.fiscal_year = :fiscalYear', { fiscalYear: filters.fiscal_year });
    }

    if (filters.type) {
      query.andWhere('transaction.type = :type', { type: filters.type });
    }

    const [data, total] = await query
      .take(limit)
      .skip(skip)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit
    };
  }

  async getMyTransactions(memberId: string) {
    return this.transactionsRepo.find({
      where: { member_id: memberId },
      order: { created_at: 'DESC' }
    });
  }
}
