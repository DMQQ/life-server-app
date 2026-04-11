import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRecurringEventFields1764800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── event_series: add priority ───────────────────────────────────────────
    await queryRunner.addColumn(
      'event_series',
      new TableColumn({ name: 'priority', type: 'int', default: 0 }),
    );

    // ─── event_occurrence: make date nullable ─────────────────────────────────
    await queryRunner.changeColumn(
      'event_occurrence',
      'date',
      new TableColumn({ name: 'date', type: 'date', isNullable: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert date to non-nullable (set NULL dates to today first to avoid constraint violation)
    await queryRunner.query(
      `UPDATE event_occurrence SET date = CURDATE() WHERE date IS NULL`,
    );
    await queryRunner.changeColumn(
      'event_occurrence',
      'date',
      new TableColumn({ name: 'date', type: 'date', isNullable: false }),
    );

    await queryRunner.dropColumn('event_series', 'priority');
  }
}
