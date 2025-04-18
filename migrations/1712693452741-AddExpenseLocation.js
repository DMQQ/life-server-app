const { MigrationInterface, QueryRunner } = require('typeorm');

module.exports = class AddExpenseLocations1712693452741 {
  name = 'AddExpenseLocations1712693452741';

  async up(queryRunner) {
    // Create expense_locations table
    await queryRunner.query(`
      CREATE TABLE \`expense_locations\` (
        \`id\` varchar(36) NOT NULL,
        \`longitude\` decimal(10,6) NULL,
        \`latitude\` decimal(10,6) NULL,
        \`name\` varchar(255) NOT NULL,
        \`kind\` varchar(255) NOT NULL,
        PRIMARY KEY (\`id\`)
      )
    `);

    // Add locationId column to expense table
    await queryRunner.query(`
      ALTER TABLE \`expense\` 
      ADD COLUMN \`locationId\` varchar(36) NULL
    `);

    // Add foreign key constraint between expense and expense_locations
    await queryRunner.query(`
      ALTER TABLE \`expense\`
      ADD CONSTRAINT \`FK_expense_location\`
      FOREIGN KEY (\`locationId\`)
      REFERENCES \`expense_locations\` (\`id\`)
      ON DELETE SET NULL
      ON UPDATE NO ACTION
    `);
  }

  async down(queryRunner) {
    // Drop foreign key constraint
    await queryRunner.query(`
      ALTER TABLE \`expense\`
      DROP FOREIGN KEY \`FK_expense_location\`
    `);

    // Drop locationId column from expense table
    await queryRunner.query(`
      ALTER TABLE \`expense\`
      DROP COLUMN \`locationId\`
    `);

    // Drop expense_locations table
    await queryRunner.query(`
      DROP TABLE \`expense_locations\`
    `);
  }
};
