import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntityUpdatePayload } from 'src/emitter/entity-emitter';
import { ExpenseEntity, ExpenseType, WalletEntity, WalletSubAccount } from '../entities/wallet.entity';

function balanceDelta(amount: number, type: string): number {
  if (type === ExpenseType.income) return amount;
  if (type === ExpenseType.expense) return -amount;
  return 0;
}

@Injectable()
export class ExpenseBalanceListener {
  constructor(
    @InjectRepository(WalletSubAccount)
    private readonly subAccountRepo: Repository<WalletSubAccount>,
    @InjectRepository(WalletEntity)
    private readonly walletRepo: Repository<WalletEntity>,
  ) {}

  @OnEvent('expense.created', { async: true })
  async onCreated(entity: ExpenseEntity) {
    if (entity.schedule) return;
    await this.adjustBalance(entity.walletId, entity.subAccountId, balanceDelta(entity.amount, entity.type));
  }

  @OnEvent('expense.updated', { async: true })
  async onUpdated({ entity, previous, changed }: EntityUpdatePayload<ExpenseEntity>) {
    const activating = changed.includes('schedule') && !entity.schedule && (previous as any).schedule;

    if (activating) {
      await this.adjustBalance(entity.walletId, entity.subAccountId, balanceDelta(entity.amount, entity.type));
      return;
    }

    if (entity.schedule) return;

    if (changed.includes('amount') || changed.includes('type') || changed.includes('subAccountId')) {
      const prevSubId = (previous as any).subAccountId ?? entity.subAccountId;
      const prevDelta = balanceDelta((previous as any).amount, (previous as any).type);
      const nextDelta = balanceDelta(entity.amount, entity.type);

      if (prevSubId === entity.subAccountId) {
        await this.adjustBalance(entity.walletId, entity.subAccountId, nextDelta - prevDelta);
      } else {
        await this.adjustBalance(entity.walletId, prevSubId, -prevDelta);
        await this.adjustBalance(entity.walletId, entity.subAccountId, nextDelta);
      }
    }
  }

  @OnEvent('expense.deleted', { async: true })
  async onDeleted(entity: ExpenseEntity) {
    if (entity.schedule) return;
    await this.adjustBalance(entity.walletId, entity.subAccountId, -balanceDelta(entity.amount, entity.type));
  }

  private async adjustBalance(walletId: string, subAccountId: string | null, delta: number) {
    if (delta === 0) return;

    let targetId = subAccountId;
    if (!targetId) {
      const general = await this.subAccountRepo.findOne({ where: { walletId, isDefault: true } });
      targetId = general?.id;
    }

    if (targetId) {
      await this.subAccountRepo.update({ id: targetId }, { balance: () => `balance + (${delta})` });
    }

    await this.walletRepo.query(
      `UPDATE wallet SET balance = (SELECT COALESCE(SUM(balance), 0) FROM wallet_sub_account WHERE walletId = ?) WHERE id = ?`,
      [walletId, walletId],
    );
  }
}
