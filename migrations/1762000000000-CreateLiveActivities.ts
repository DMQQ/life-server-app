import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

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
            default: '0',
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('live_activities');
    if (table) {
      const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.indexOf('timelineId') !== -1);
      if (foreignKey) {
        await queryRunner.dropForeignKey('live_activities', foreignKey);
      }
    }
    await queryRunner.dropTable('live_activities');
  }
}
