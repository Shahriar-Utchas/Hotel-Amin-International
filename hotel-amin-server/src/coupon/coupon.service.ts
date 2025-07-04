import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Coupon } from './entities/coupon.entity';
import { CouponUsage } from './entities/coupon-usage.entity';
import { Repository } from 'typeorm';
import { Employee } from 'src/management/entities/employee.entity';
import { CreateCouponDto } from './DTOs/create-coupon.dto';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
    @InjectRepository(CouponUsage)
    private readonly couponUsageRepository: Repository<CouponUsage>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
  ) { }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredCoupons() {
    await this.couponRepository
      .createQueryBuilder()
      .update(Coupon)
      .set({ is_active: false })
      .where('(expire_at < NOW() OR quantity <= 0) AND is_active = true')
      .execute();
  }

  public async getAllCoupons() {
    return await this.couponRepository.find();
  }

  public async getCouponUsage() {
    return await this.couponUsageRepository.find({
      relations: ['coupon', 'booking', 'used_by'],
    });
  }

  public async getCouponUsageByCode(coupon_code: string) {
    const couponUsage = await this.couponUsageRepository.findOne({
      where: { coupon_code },
      relations: ['coupon', 'booking', 'used_by'],
    });
    if (!couponUsage) {
      throw new NotFoundException(
        `Coupon usage with code '${coupon_code}' not found`,
      );
    }
    return couponUsage;
  }

  public async createCoupon(createCouponDto: CreateCouponDto) {
    const employee = await this.employeeRepository.findOne({
      where: { employee_id: createCouponDto.employee_id },
    });
    if (!employee) {
      throw new Error('Employee not found');
    }
    const coupon = this.couponRepository.create({
      ...createCouponDto,
      created_by: employee,
    });
    return await this.couponRepository.save(coupon);
  }

  public async getCouponByCode(coupon_code: string) {
    const coupon = await this.couponRepository.findOne({
      where: { coupon_code },
      relations: ['created_by'],
    });

    if (!coupon) {
      throw new NotFoundException(
        `Coupon with code '${coupon_code}' not found`,
      );
    }
    return coupon;
  }
  public async deleteCoupon(coupon_code: string) {
    const coupon = await this.couponRepository.findOne({
      where: { coupon_code },
    });
    if (!coupon) {
      throw new Error('Coupon not found');
    }
    await this.couponRepository.remove(coupon);
    return { message: 'Coupon deleted successfully' };
  }

  public async updateCouponData(
    coupon_id: number,
    updateData: Partial<CreateCouponDto>,
  ) {
    const existingCoupon = await this.couponRepository.findOne({
      where: { coupon_id },
    });
    if (!existingCoupon) {
      throw new NotFoundException(`Coupon with ID '${coupon_id}' not found`);
    }
    await this.couponRepository.update(coupon_id, updateData);
    return await this.couponRepository.findOne({ where: { coupon_id } });
  }

  public async updateCoupon(coupon_code: string, coupon_id: number) {
    const existingCoupon = await this.couponRepository.findOne({
      where: { coupon_code },
    });
    if (!existingCoupon) {
      throw new NotFoundException(`Coupon with ID '${coupon_code}' not found`);
    }
    await this.couponRepository.update(coupon_id, {
      ...existingCoupon,
      quantity: existingCoupon.quantity - 1,
    });
  }
}
