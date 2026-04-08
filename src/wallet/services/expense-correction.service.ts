import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCorrectionMapEntity } from '../entities/expense-correction-map.entity';
import { WalletEntity } from '../entities/wallet.entity';
import { CreateCorrectionMapDto, UpdateCorrectionMapDto } from '../types/expense-correction.schemas';

export interface CorrectionInput {
  description: string;
  shop?: string;
  category?: string;
  amount?: number;
}

export interface CorrectionResult extends CorrectionInput {
  corrected: boolean;
  appliedRuleId?: string;
}

@Injectable()
export class ExpenseCorrectionService {
  constructor(
    @InjectRepository(ExpenseCorrectionMapEntity)
    private readonly correctionRepo: Repository<ExpenseCorrectionMapEntity>,

    @InjectRepository(WalletEntity)
    private readonly walletRepo: Repository<WalletEntity>,
  ) {}

  async getWalletId(userId: string): Promise<string | null> {
    const wallet = await this.walletRepo.findOne({ where: { userId } });
    return wallet?.id ?? null;
  }

  async findAll(userId: string): Promise<ExpenseCorrectionMapEntity[]> {
    const walletId = await this.getWalletId(userId);
    if (!walletId) return [];
    return this.correctionRepo.find({ where: { walletId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ExpenseCorrectionMapEntity | null> {
    return this.correctionRepo.findOne({ where: { id } });
  }

  async create(userId: string, input: CreateCorrectionMapDto): Promise<ExpenseCorrectionMapEntity> {
    const walletId = await this.getWalletId(userId);
    if (!walletId) throw new Error('Wallet not found');

    const entity = this.correctionRepo.create({
      walletId,
      matchShop: input.matchShop ?? null,
      matchDescription: input.matchDescription ?? null,
      matchCategory: input.matchCategory ?? null,
      matchAmountMin: input.matchAmountMin ?? null,
      matchAmountMax: input.matchAmountMax ?? null,
      overrideShop: input.overrideShop ?? null,
      overrideCategory: input.overrideCategory ?? null,
      overrideDescription: input.overrideDescription ?? null,
      isActive: true,
    });

    return this.correctionRepo.save(entity);
  }

  async update(id: string, input: UpdateCorrectionMapDto): Promise<ExpenseCorrectionMapEntity> {
    await this.correctionRepo.update(id, input as Partial<ExpenseCorrectionMapEntity>);
    return this.correctionRepo.findOne({ where: { id } });
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.correctionRepo.delete(id);
    return result.affected > 0;
  }

  async applyCorrections(userId: string, input: CorrectionInput): Promise<CorrectionResult> {
    const walletId = await this.getWalletId(userId);
    if (!walletId) return { ...input, corrected: false };

    const maps = await this.correctionRepo.find({ where: { walletId, isActive: true } });

    let result: CorrectionResult = { ...input, corrected: false };

    for (const map of maps) {
      if (this.matches(result, map)) {
        if (map.overrideShop !== null) result.shop = map.overrideShop;
        if (map.overrideCategory !== null) result.category = map.overrideCategory;
        if (map.overrideDescription !== null) result.description = map.overrideDescription;
        result.corrected = true;
        result.appliedRuleId = map.id;
        // First match wins
        break;
      }
    }

    return result;
  }

  /**
   * Matches a value against a pattern.
   * - `/pattern/flags` → regex
   * - Pattern with `*` or `?` → glob wildcard (full-string match)
   * - Otherwise → case-insensitive substring
   */
  private matchesPattern(value: string, pattern: string): boolean {
    const regexLiteral = pattern.match(/^\/(.+)\/([gimsuy]*)$/);
    if (regexLiteral) {
      try {
        const re = new RegExp(regexLiteral[1], regexLiteral[2] || 'i');
        return re.test(value);
      } catch {
        // fall through to substring
      }
    }

    if (pattern.includes('*') || pattern.includes('?')) {
      try {
        const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
        const re = new RegExp(`^${escaped}$`, 'i');
        return re.test(value);
      } catch {
        // fall through to substring
      }
    }

    return value.toLowerCase().includes(pattern.toLowerCase());
  }

  private matches(input: CorrectionInput, map: ExpenseCorrectionMapEntity): boolean {
    if (map.matchShop !== null) {
      const target = input.shop ?? input.description ?? '';
      if (!this.matchesPattern(target, map.matchShop)) return false;
    }

    if (map.matchDescription !== null) {
      const desc = input.description ?? '';
      if (!this.matchesPattern(desc, map.matchDescription)) return false;
    }

    if (map.matchCategory !== null) {
      if (input.category?.toLowerCase() !== map.matchCategory.toLowerCase()) return false;
    }

    if (map.matchAmountMin !== null && input.amount !== undefined) {
      if (input.amount < map.matchAmountMin) return false;
    }

    if (map.matchAmountMax !== null && input.amount !== undefined) {
      if (input.amount > map.matchAmountMax) return false;
    }

    // Ensure at least one match condition was actually set
    const hasAnyCondition =
      map.matchShop !== null ||
      map.matchDescription !== null ||
      map.matchCategory !== null ||
      map.matchAmountMin !== null ||
      map.matchAmountMax !== null;

    return hasAnyCondition;
  }
}
