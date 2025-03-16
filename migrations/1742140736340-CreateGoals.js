const typeorm = require('typeorm');
const Table = typeorm.Table;
const TableForeignKey = typeorm.TableForeignKey;

module.exports = class CreateUserGoalsTables1742140736340 {
  async up(queryRunner) {
    await queryRunner.createTable(
      new Table({
        name: 'user_goal',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'userId',
            type: 'varchar',
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'goal_category',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
          },
          {
            name: 'icon',
            type: 'varchar',
          },
          {
            name: 'description',
            type: 'varchar',
          },
          {
            name: 'target',
            type: 'float',
            default: 0,
          },
          {
            name: 'min',
            type: 'float',
            default: 0,
          },
          {
            name: 'max',
            type: 'float',
            default: 0,
          },
          {
            name: 'unit',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'goalId',
            type: 'uuid',
          },
        ],
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: 'goal_entry',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'value',
            type: 'float',
          },
          {
            name: 'date',
            type: 'timestamp',
          },
          {
            name: 'goalsId',
            type: 'uuid',
          },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'goal_category',
      new TableForeignKey({
        columnNames: ['goalId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'user_goal',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'goal_entry',
      new TableForeignKey({
        columnNames: ['goalsId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'goal_category',
        onDelete: 'CASCADE',
      }),
    );
  }

  async down(queryRunner) {
    const goalEntryTable = await queryRunner.getTable('goal_entry');
    const goalEntryForeignKey = goalEntryTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('goalsId') !== -1,
    );
    if (goalEntryForeignKey) {
      await queryRunner.dropForeignKey('goal_entry', goalEntryForeignKey);
    }

    const goalCategoryTable = await queryRunner.getTable('goal_category');
    const goalCategoryForeignKey = goalCategoryTable?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('goalId') !== -1,
    );
    if (goalCategoryForeignKey) {
      await queryRunner.dropForeignKey('goal_category', goalCategoryForeignKey);
    }

    await queryRunner.dropTable('goal_entry');
    await queryRunner.dropTable('goal_category');
    await queryRunner.dropTable('user_goal');
  }
};
