import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorAiChatHistory1765100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE statistics_ai_chat_history MODIFY COLUMN aiMessage TEXT NULL`);
    const table = await queryRunner.getTable('statistics_ai_chat_history');
    if (table.findColumnByName('skills')) {
      await queryRunner.query(`ALTER TABLE statistics_ai_chat_history DROP COLUMN skills`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE statistics_ai_chat_history ADD COLUMN skills JSON NOT NULL`);
    await queryRunner.query(`ALTER TABLE statistics_ai_chat_history MODIFY COLUMN aiMessage TEXT NOT NULL`);
    await queryRunner.query(`ALTER TABLE statistics_ai_chat_history DROP COLUMN aiMessages`);
  }
}
