/**
 * @typedef {import('typeorm').MigrationInterface} MigrationInterface
 */

/**
 * @class
 * @implements {MigrationInterface}
 */
module.exports = class AddEnabledNotifications1756453017644 {
  async up(queryRunner) {
    await queryRunner.query(`
            ALTER TABLE "notifications"
            ADD COLUMN "enabledNotifications" boolean NOT NULL DEFAULT true
        `);
  }

  async down(queryRunner) {
    await queryRunner.query(`
            ALTER TABLE "notifications"
            DROP COLUMN "enabledNotifications"
        `);
  }
};
