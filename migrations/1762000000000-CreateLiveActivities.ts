import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class CreateLiveActivities1762000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'live_activities',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'beginTime',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'endTime',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'sent', 'update', 'end'],
            default: "'pending'",
          },
          {
            name: 'updateToken',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'lastUpdated',
            type: 'bigint',
            default: 'UNIX_TIMESTAMP() * 1000',
          },
          {
            name: 'timelineId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'live_activities',
      new TableForeignKey({
        columnNames: ['timelineId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'timeline',
        onDelete: 'CASCADE',
      }),
    );

    // Create unique index to ensure one-to-one relationship
    await queryRunner.createIndex('live_activities', {
      name: 'IDX_LIVE_ACTIVITIES_TIMELINE_ID_UNIQUE',
      columnNames: ['timelineId'],
      isUnique: true,
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('live_activities');
    if (table) {
      // Drop unique index
      await queryRunner.dropIndex('live_activities', 'IDX_LIVE_ACTIVITIES_TIMELINE_ID_UNIQUE');
      
      // Drop foreign key
      const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('timelineId') !== -1);
      if (foreignKey) {
        await queryRunner.dropForeignKey('live_activities', foreignKey);
      }
    }
    await queryRunner.dropTable('live_activities');
  }
}