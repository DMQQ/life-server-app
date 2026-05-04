import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRecurrenceRedesignFields1765600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── event_series: new recurrence columns ────────────────────────────
    await queryRunner.addColumns('event_series', [
      new TableColumn({ name: 'repeatType', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'repeatDaysOfWeek', type: 'varchar', length: '50', isNullable: true }),
      new TableColumn({ name: 'repeatInterval', type: 'int', default: 1, isNullable: true }),
      new TableColumn({ name: 'repeatUntil', type: 'date', isNullable: true }),
      new TableColumn({ name: 'reminderBeforeMinutes', type: 'int', isNullable: true }),
    ]);

    // ─── event_occurrence: isException flag ──────────────────────────────
    await queryRunner.addColumn(
      'event_occurrence',
      new TableColumn({ name: 'isException', type: 'boolean', default: false }),
    );

    // ─── backfill legacy data ────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE event_series
      SET repeatType = UPPER(repeatFrequency),
          repeatInterval = COALESCE(repeatEveryNth, 1)
      WHERE isRepeat = true AND repeatType IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('event_occurrence', 'isException');

    await queryRunner.dropColumns('event_series', [
      'reminderBeforeMinutes',
      'repeatUntil',
      'repeatInterval',
      'repeatDaysOfWeek',
      'repeatType',
    ]);
  }
}
