import { MigrationInterface, QueryRunner } from 'typeorm';

export class AssignExpensesToGeneralAccount1765400002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Assign all expenses without a sub-account to their wallet's General account
    await queryRunner.query(`
      UPDATE expense e
      JOIN wallet_sub_account sa ON sa.walletId = e.walletId AND sa.isDefault = 1
      SET e.subAccountId = sa.id
      WHERE e.subAccountId IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Not reversible — we don't know which were originally NULL
  }
}
