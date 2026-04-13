import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWalletIdToAiChatHistory1765300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_chat_history ADD COLUMN walletId varchar(36) NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_chat_history DROP COLUMN walletId`);
  }
}
