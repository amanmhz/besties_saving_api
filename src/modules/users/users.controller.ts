import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../database/entities/user.entity';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() body: any, @CurrentUser() currentUser: any) {
    // Admins cannot create SuperAdmins
    if (body.role === UserRole.SUPER_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SuperAdmins can create other SuperAdmins');
    }
    return this.usersService.create(body);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MEMBER)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.findAll(
      undefined,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: any) {
    // Users can only view themselves unless they are admins
    if (currentUser.role === UserRole.MEMBER && currentUser.id !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    return this.usersService.findById(id);
  }

  @Get(':id/profile')
  getProfile(@Param('id') id: string, @CurrentUser() currentUser: any) {
    if (currentUser.role === UserRole.MEMBER && currentUser.id !== id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    return this.usersService.getProfile(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() currentUser: any) {
    // Only SuperAdmin/Admin can update others. Members can only update themselves.
    if (currentUser.role === UserRole.MEMBER && currentUser.id !== id) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Admins cannot promote anyone to SuperAdmin
    if (body.role === UserRole.SUPER_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only SuperAdmins can promote others to SuperAdmin');
    }

    return this.usersService.update(id, body, { id: currentUser.id, role: currentUser.role });
  }
}
