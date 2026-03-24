import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class TimelineRewrite1763200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. event_series ─────────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'event_series',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'title', type: 'varchar', length: '150' },
          { name: 'description', type: 'text' },
          { name: 'beginTime', type: 'time', isNullable: true },
          { name: 'endTime', type: 'time', isNullable: true },
          { name: 'isAllDay', type: 'tinyint', width: 1, default: 0 },
          { name: 'notification', type: 'tinyint', width: 1, default: 1 },
          { name: 'isPublic', type: 'tinyint', width: 1, default: 0 },
          { name: 'tags', type: 'varchar', length: '50', default: "''" },
          { name: 'userId', type: 'varchar', length: '36' },
          { name: 'isRepeat', type: 'tinyint', width: 1, default: 0 },
          { name: 'repeatFrequency', type: 'varchar', length: '20', isNullable: true },
          { name: 'repeatEveryNth', type: 'int', isNullable: true },
          { name: 'repeatCount', type: 'int', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'event_series',
      new TableIndex({ name: 'IDX_event_series_userId', columnNames: ['userId'] }),
    );

    // ─── 2. event_occurrence ─────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'event_occurrence',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'seriesId', type: 'varchar', length: '36' },
          { name: 'date', type: 'date' },
          { name: 'position', type: 'int', default: 0 },
          { name: 'isCompleted', type: 'tinyint', width: 1, default: 0 },
          { name: 'isSkipped', type: 'tinyint', width: 1, default: 0 },
          { name: 'titleOverride', type: 'varchar', length: '150', isNullable: true },
          { name: 'descriptionOverride', type: 'text', isNullable: true },
          { name: 'beginTimeOverride', type: 'time', isNullable: true },
          { name: 'endTimeOverride', type: 'time', isNullable: true },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createIndex(
      'event_occurrence',
      new TableIndex({ name: 'IDX_event_occurrence_seriesId', columnNames: ['seriesId'] }),
    );
    await queryRunner.createIndex(
      'event_occurrence',
      new TableIndex({ name: 'IDX_event_occurrence_date', columnNames: ['date'] }),
    );
    await queryRunner.createForeignKey(
      'event_occurrence',
      new TableForeignKey({
        columnNames: ['seriesId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'event_series',
        onDelete: 'CASCADE',
      }),
    );

    // ─── 3. occurrence_todos ─────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'occurrence_todos',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'occurrenceId', type: 'varchar', length: '36' },
          { name: 'title', type: 'varchar', length: '255' },
          { name: 'isCompleted', type: 'tinyint', width: 1, default: 0 },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
          { name: 'modifiedAt', type: 'datetime', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'occurrence_todos',
      new TableForeignKey({
        columnNames: ['occurrenceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'event_occurrence',
        onDelete: 'CASCADE',
      }),
    );

    // ─── 4. occurrence_files ─────────────────────────────────────────────────
    await queryRunner.createTable(
      new Table({
        name: 'occurrence_files',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, generationStrategy: 'uuid' },
          { name: 'occurrenceId', type: 'varchar', length: '36' },
          { name: 'name', type: 'varchar', length: '100' },
          { name: 'type', type: 'varchar', length: '100' },
          { name: 'url', type: 'varchar', length: '255' },
          { name: 'isPublic', type: 'tinyint', width: 1, default: 0 },
          { name: 'createdAt', type: 'datetime', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'occurrence_files',
      new TableForeignKey({
        columnNames: ['occurrenceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'event_occurrence',
        onDelete: 'CASCADE',
      }),
    );

    // ─── 5. todo_files: retarget FK from timeline_todos → occurrence_todos ───
    const todoFilesTable = await queryRunner.getTable('todo_files');
    if (todoFilesTable) {
      const oldFk = todoFilesTable.foreignKeys.find((fk) => fk.columnNames.includes('todoId'));
      if (oldFk) await queryRunner.dropForeignKey('todo_files', oldFk);
      // Existing rows reference old timeline_todos IDs — they're orphaned, remove them
      await queryRunner.query('DELETE FROM todo_files');
    }

    await queryRunner.createForeignKey(
      'todo_files',
      new TableForeignKey({
        columnNames: ['todoId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'occurrence_todos',
        onDelete: 'CASCADE',
      }),
    );

    // ─── 6. live_activities: timelineId → occurrenceId ───────────────────────
    const laTable = await queryRunner.getTable('live_activities');
    if (laTable) {
      const oldFk = laTable.foreignKeys.find((fk) => fk.columnNames.includes('timelineId'));
      if (oldFk) await queryRunner.dropForeignKey('live_activities', oldFk);
      // Existing records reference old timeline IDs — no longer usable
      await queryRunner.query('DELETE FROM live_activities');
      await queryRunner.renameColumn('live_activities', 'timelineId', 'occurrenceId');
    }

    await queryRunner.createForeignKey(
      'live_activities',
      new TableForeignKey({
        columnNames: ['occurrenceId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'event_occurrence',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert live_activities
    const laTable = await queryRunner.getTable('live_activities');
    if (laTable) {
      const fk = laTable.foreignKeys.find((fk) => fk.columnNames.includes('occurrenceId'));
      if (fk) await queryRunner.dropForeignKey('live_activities', fk);
    }
    await queryRunner.query('DELETE FROM live_activities');
    await queryRunner.renameColumn('live_activities', 'occurrenceId', 'timelineId');
    await queryRunner.createForeignKey(
      'live_activities',
      new TableForeignKey({
        columnNames: ['timelineId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'timeline',
        onDelete: 'CASCADE',
      }),
    );

    // Revert todo_files FK
    const todoFilesTable = await queryRunner.getTable('todo_files');
    if (todoFilesTable) {
      const fk = todoFilesTable.foreignKeys.find((fk) => fk.columnNames.includes('todoId'));
      if (fk) await queryRunner.dropForeignKey('todo_files', fk);
    }
    await queryRunner.createForeignKey(
      'todo_files',
      new TableForeignKey({
        columnNames: ['todoId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'timeline_todos',
        onDelete: 'CASCADE',
      }),
    );

    // Drop new tables (reverse dependency order)
    await queryRunner.dropTable('occurrence_files', true);
    await queryRunner.dropTable('occurrence_todos', true);
    await queryRunner.dropTable('event_occurrence', true);
    await queryRunner.dropTable('event_series', true);
  }
}
