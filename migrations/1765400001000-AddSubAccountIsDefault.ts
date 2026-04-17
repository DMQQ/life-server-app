import { MigrationInterface, QueryRunner } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export class AddSubAccountIsDefault1765400001000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Add isDefault column
    await queryRunner.query(`
      ALTER TABLE wallet_sub_account
      ADD COLUMN isDefault tinyint(1) NOT NULL DEFAULT 0
    `);

    // Seed a General sub-account for wallets that have no sub-accounts yet,
    // carrying over the existing wallet.balance into that account.
    const wallets: { id: string; balance: number }[] = await queryRunner.query(`
      SELECT w.id, w.balance
      FROM wallet w
      LEFT JOIN wallet_sub_account sa ON sa.walletId = w.id AND sa.isDefault = 1
      WHERE sa.id IS NULL
    `);

    for (const wallet of wallets) {
      const id = uuidv4();
      await queryRunner.query(
        `INSERT INTO wallet_sub_account (id, name, balance, isDefault, icon, color, walletId) VALUES (?, 'General', ?, 1, 'bank', '#7B84FF', ?)`,
        [id, wallet.balance, wallet.id],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM wallet_sub_account WHERE isDefault = 1`);
    await queryRunner.query(`ALTER TABLE wallet_sub_account DROP COLUMN isDefault`);
  }
}
