import { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomSubscriptionPeriod1765500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subscriptions
      MODIFY COLUMN billingCycle ENUM('daily','weekly','monthly','yearly','custom') NOT NULL DEFAULT 'monthly'
    `);

    await queryRunner.query(`
      ALTER TABLE subscriptions
      ADD COLUMN billingDay INT NULL DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE subscriptions
      ADD COLUMN customBillingMonths JSON NULL DEFAULT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE subscriptions
      ADD COLUMN reminderDaysBeforehand INT NOT NULL DEFAULT 3
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE subscriptions DROP COLUMN reminderDaysBeforehand`);
    await queryRunner.query(`ALTER TABLE subscriptions DROP COLUMN customBillingMonths`);
    await queryRunner.query(`ALTER TABLE subscriptions DROP COLUMN billingDay`);
    await queryRunner.query(`
      ALTER TABLE subscriptions
      MODIFY COLUMN billingCycle ENUM('daily','weekly','monthly','yearly') NOT NULL DEFAULT 'monthly'
    `);
  }
}
