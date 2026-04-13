import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiChatHistory1765200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_chat_history (
        id          VARCHAR(36)  NOT NULL,
        userId      VARCHAR(36)  NOT NULL,
        userMessage TEXT         NOT NULL,
        aiMessages  JSON         NULL,
        startDate   VARCHAR(20)  NULL,
        endDate     VARCHAR(20)  NULL,
        createdAt   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_ai_chat_history_userId (userId)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE ai_chat_history`);
  }
}
