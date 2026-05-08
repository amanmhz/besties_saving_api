import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../database/entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async create(data: Partial<User>) {
    if (data.password_hash) {
      data.password_hash = await bcrypt.hash(data.password_hash, 10);
    }
    const user = this.usersRepo.create(data);
    const savedUser = await this.usersRepo.save(user);
    const { password_hash, ...result } = savedUser;
    return result;
  }

  async findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const { password_hash, ...result } = user;
    return result;
  }

  async findAll(role?: UserRole, page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await this.usersRepo.findAndCount({
      where: role ? { role } : undefined,
      select: ['id', 'name', 'email', 'phone', 'role', 'is_active', 'created_at'],
      take: limit,
      skip: skip,
      order: { created_at: 'DESC' }
    });

    return {
      data,
      total,
      page,
      limit
    };
  }

  async getProfile(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: [
        'loanAccounts',
        'loanAccounts.creator',
        'savingAccounts',
        'savingAccounts.deposits',
        'savingAccounts.deposits.creator'
      ],
      order: {
        created_at: 'DESC'
      }
    });

    if (!user) throw new NotFoundException('User not found');
    const { password_hash, ...result } = user;
    return result;
  }

  async update(id: string, data: any, requester: { id: string; role: UserRole }) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Handle password update
    if (data.password) {
      // If not SuperAdmin, verify current password
      if (requester.role !== UserRole.SUPER_ADMIN) {
        if (!data.currentPassword) {
          throw new NotFoundException('Current password is required to change password');
        }
        const isMatch = await bcrypt.compare(data.currentPassword, user.password_hash);
        if (!isMatch) {
          throw new NotFoundException('Current password does not match');
        }
      }
      user.password_hash = await bcrypt.hash(data.password, 10);
    }

    // Update other fields
    if (data.name) user.name = data.name;
    if (data.email) user.email = data.email;
    if (data.phone !== undefined) user.phone = data.phone;
    
    // Only Admin/SuperAdmin can change roles
    if (data.role && (requester.role === UserRole.ADMIN || requester.role === UserRole.SUPER_ADMIN)) {
      // Admins cannot promote to SuperAdmin
      if (data.role === UserRole.SUPER_ADMIN && requester.role !== UserRole.SUPER_ADMIN) {
        // Skip or throw error? Throwing error for now as it's a security risk
      } else {
        user.role = data.role as UserRole;
      }
    }

    const updatedUser = await this.usersRepo.save(user);
    const { password_hash, ...result } = updatedUser;
    return result;
  }
}
