import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { DateConverter } from '../../common/utils/date-converter.util';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepo: Repository<Transaction>,
  ) {}

  async findAll(filters: { member_id?: string; created_by?: string; fiscal_year?: string; fiscal_quarter?: string; type?: string; reference?: string; description?: string; date_from?: string; date_to?: string; page?: number; limit?: number; }) {
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const skip = (page - 1) * limit;

    const query = this.transactionsRepo.createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.user', 'user')
      .leftJoinAndSelect('transaction.creator', 'creator')
      .orderBy('transaction.sn', 'DESC');

    if (filters.member_id) {
      query.andWhere('transaction.member_id = :memberId', { memberId: filters.member_id });
    }

    if (filters.created_by) {
      query.andWhere('transaction.created_by = :createdBy', { createdBy: filters.created_by });
    }

    if (filters.fiscal_year) {
      query.andWhere('transaction.fiscal_year = :fiscalYear', { fiscalYear: filters.fiscal_year });
    }

    if (filters.fiscal_quarter) {
      query.andWhere('transaction.fiscal_quarter = :fiscalQuarter', { fiscalQuarter: filters.fiscal_quarter });
    }

    if (filters.type) {
      query.andWhere('transaction.type = :type', { type: filters.type });
    }

    if (filters.reference) {
      query.andWhere('transaction.reference ILIKE :reference', { reference: `%${filters.reference}%` });
    }

    if (filters.description) {
      query.andWhere('transaction.description ILIKE :description', { description: `%${filters.description}%` });
    }

    if (filters.date_from) {
      const adFrom = DateConverter.bsToAd(filters.date_from);
      query.andWhere('transaction.ad_date >= :dateFrom', { dateFrom: adFrom });
    }

    if (filters.date_to) {
      const adTo = DateConverter.bsToAd(filters.date_to);
      query.andWhere('transaction.ad_date <= :dateTo', { dateTo: adTo });
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
      order: { sn: 'DESC' }
    });
  }
}
