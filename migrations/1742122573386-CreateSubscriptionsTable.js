const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class CreateSubscriptionTable1742122573386 {
  name = 'CreateSubscriptionTable1742122573386';

  async up(queryRunner) {
    // Create the subscriptions table
    await queryRunner.query(`
      CREATE TABLE \`subscriptions\` (
        \`id\` varchar(36) NOT NULL,
        \`amount\` float NOT NULL,
        \`dateStart\` timestamp NOT NULL,
        \`dateEnd\` timestamp NULL,
        \`description\` text NOT NULL,
        \`isActive\` tinyint NOT NULL,
        \`billingCycle\` enum('daily', 'weekly', 'monthly', 'yearly') NOT NULL DEFAULT 'monthly',
        \`nextBillingDate\` timestamp NOT NULL,
        \`walletId\` varchar(36) NOT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);

    // Add subscriptionId, note, shop, and tags columns to expense table
    await queryRunner.query(`
      ALTER TABLE \`expense\` 
      ADD \`subscriptionId\` varchar(36) NULL,
      ADD \`note\` varchar(255) NULL,
      ADD \`shop\` varchar(255) NULL, 
      ADD \`tags\` varchar(255) NULL
    `);

    // Add foreign key
    await queryRunner.query(`
      ALTER TABLE \`expense\` 
      ADD CONSTRAINT \`FK_expense_subscription\` 
      FOREIGN KEY (\`subscriptionId\`) REFERENCES \`subscriptions\`(\`id\`) 
      ON DELETE SET NULL ON UPDATE CASCADE
    `);
  }

  async down(queryRunner) {
    // Drop foreign key
    await queryRunner.query(`
      ALTER TABLE \`expense\` 
      DROP FOREIGN KEY \`FK_expense_subscription\`
    `);

    // Drop columns from expense table
    await queryRunner.query(`
      ALTER TABLE \`expense\` 
      DROP COLUMN \`subscriptionId\`,
      DROP COLUMN \`note\`,
      DROP COLUMN \`shop\`,
      DROP COLUMN \`tags\`
    `);

    // Drop subscriptions table
    await queryRunner.query(`DROP TABLE \`subscriptions\``);
  }
};
