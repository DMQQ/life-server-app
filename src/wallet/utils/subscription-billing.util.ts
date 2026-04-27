import * as dayjs from 'dayjs';
import { BillingCycleEnum, SubscriptionEntity } from '../entities/subscription.entity';

export class SubscriptionBillingUtils {
  static getBillingCycleString(nextBillingDate: string | Date, billingCycle: BillingCycleEnum): string {
    switch (billingCycle) {
      case BillingCycleEnum.MONTHLY:
        return `${dayjs(nextBillingDate).subtract(30, 'days').format('MM-DD')}-${dayjs(nextBillingDate).format('MM-DD')}`;
      case BillingCycleEnum.WEEKLY:
        return `${dayjs(nextBillingDate).subtract(7, 'days').format('MM-DD')}-${dayjs(nextBillingDate).format('MM-DD')}`;
      case BillingCycleEnum.DAILY:
        return `${dayjs(nextBillingDate).subtract(1, 'days').format('MM-DD')}-${dayjs(nextBillingDate).format('MM-DD')}`;
      case BillingCycleEnum.YEARLY:
        return `${dayjs(nextBillingDate).subtract(1, 'year').format('YYYY-MM')}-${dayjs(nextBillingDate).format('YYYY-MM')}`;
      case BillingCycleEnum.CUSTOM:
        return `${dayjs(nextBillingDate).subtract(1, 'month').format('YYYY-MM')}-${dayjs(nextBillingDate).format('YYYY-MM')}`;
      default:
        throw new Error('Invalid billing cycle');
    }
  }

  static snapToBillingDay(date: Date, billingDay?: number | null): Date {
    if (!billingDay) return date;
    const d = dayjs(date);
    return d.date(Math.min(billingDay, d.daysInMonth())).toDate();
  }

  static getNextCustomBillingDate(currentDate: Date, months: number[], billingDay?: number | null): Date {
    if (!months || months.length === 0) {
      throw new Error('customBillingMonths must be set for CUSTOM billing cycle');
    }
    const sorted = [...months].sort((a, b) => a - b);
    const current = dayjs(currentDate);
    const currentMonth = current.month() + 1;

    const nextMonth = sorted.find((m) => m > currentMonth);

    let nextDate: dayjs.Dayjs;
    if (nextMonth) {
      nextDate = current.year(current.year()).month(nextMonth - 1);
    } else {
      nextDate = current.year(current.year() + 1).month(sorted[0] - 1);
    }

    const day = billingDay ? Math.min(billingDay, nextDate.daysInMonth()) : 1;
    return nextDate.date(day).toDate();
  }

  static getNextBillingDate(subscription: SubscriptionEntity): Date {
    let raw: Date;
    switch (subscription.billingCycle) {
      case BillingCycleEnum.MONTHLY:
        raw = dayjs(subscription.nextBillingDate).add(1, 'month').toDate();
        break;
      case BillingCycleEnum.WEEKLY:
        raw = dayjs(subscription.nextBillingDate).add(7, 'days').toDate();
        break;
      case BillingCycleEnum.DAILY:
        raw = dayjs(subscription.nextBillingDate).add(1, 'day').toDate();
        break;
      case BillingCycleEnum.YEARLY:
        raw = dayjs(subscription.nextBillingDate).add(1, 'year').toDate();
        break;
      case BillingCycleEnum.CUSTOM:
        return SubscriptionBillingUtils.getNextCustomBillingDate(
          subscription.nextBillingDate,
          subscription.customBillingMonths ?? [],
          subscription.billingDay,
        );
      default:
        throw new Error('Invalid billing cycle');
    }
    return SubscriptionBillingUtils.snapToBillingDay(raw, subscription.billingDay);
  }
}
