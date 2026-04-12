import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStatisticsAiChatHistory1765000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE statistics_ai_chat_history (
        id         VARCHAR(36)  NOT NULL,
        userId     VARCHAR(36)  NOT NULL,
        userMessage TEXT        NOT NULL,
        aiMessage  TEXT         NOT NULL,
        statTypes  JSON         NOT NULL,
        skills     JSON         NOT NULL,
        startDate  VARCHAR(20)  NULL,
        endDate    VARCHAR(20)  NULL,
        createdAt  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE statistics_ai_chat_history`);
  }
}
