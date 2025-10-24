import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class Migrations1761148863075 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'wallet',
      new TableColumn({
        name: 'paycheckDate',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('wallet', 'paycheckDate');
  }
}
