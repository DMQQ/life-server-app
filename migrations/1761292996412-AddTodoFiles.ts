import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class AddTodoFiles1761292996412 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'todo_files',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'todoId',
            type: 'varchar',
            length: '36',
            isNullable: false,
          },
          {
            name: 'type',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'url',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    await queryRunner.createForeignKey(
      'todo_files',
      new TableForeignKey({
        columnNames: ['todoId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'timeline_todos',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('todo_files');
    if (table) {
      const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('todoId') !== -1);
      if (foreignKey) {
        await queryRunner.dropForeignKey('todo_files', foreignKey);
      }
    }
    await queryRunner.dropTable('todo_files');
  }
}
