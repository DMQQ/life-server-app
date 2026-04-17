import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletSubAccounts1765400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wallet_sub_account (
        id varchar(36) NOT NULL PRIMARY KEY,
        name varchar(255) NOT NULL,
        description varchar(255) NULL,
        color varchar(50) NULL,
        icon varchar(100) NULL,
        balance float NOT NULL DEFAULT 0,
        walletId varchar(36) NOT NULL,
        CONSTRAINT fk_sub_account_wallet FOREIGN KEY (walletId) REFERENCES wallet(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      ALTER TABLE expense ADD COLUMN subAccountId varchar(36) NULL,
      ADD CONSTRAINT fk_expense_sub_account FOREIGN KEY (subAccountId) REFERENCES wallet_sub_account(id) ON DELETE SET NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE expense DROP FOREIGN KEY fk_expense_sub_account`);
    await queryRunner.query(`ALTER TABLE expense DROP COLUMN subAccountId`);
    await queryRunner.query(`DROP TABLE wallet_sub_account`);
  }
}
