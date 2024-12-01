const { MigrationInterface, QueryRunner } = require('typeorm');

type MigrationInterface2 = typeof MigrationInterface;

exports.WalletAddRefundsAndMoreInfo1733078606888 = class WalletAddRefundsAndMoreInfo1733078606888
  implements MigrationInterface2
{
  public async up(queryRunner: typeof QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE expense MODIFY COLUMN type ENUM("income","expense","refunded") NOT NULL',
    );
    await queryRunner.query('ALTER TABLE expense ADD COLUMN note VARCHAR(255)');

    await queryRunner.query('ALTER TABLE expense ADD COLUMN shop VARCHAR(255)');

    await queryRunner.query('ALTER TABLE expense ADD COLUMN tags VARCHAR(255)');
  }

  public async down(queryRunner: typeof QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE expense DROP COLUMN note');

    await queryRunner.query('ALTER TABLE expense DROP COLUMN shop');

    await queryRunner.query('ALTER TABLE expense DROP COLUMN tags');
  }
};
