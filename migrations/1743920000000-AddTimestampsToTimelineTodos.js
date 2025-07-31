const typeorm = require('typeorm');
const TableColumn = typeorm.TableColumn;

module.exports = class AddTimestampsToTimelineTodos1743920000000 {
  async up(queryRunner) {
    // Check if createdAt column exists, if not add it
    const hasCreatedAt = await queryRunner.hasColumn('timeline_todos', 'createdAt');
    if (!hasCreatedAt) {
      await queryRunner.addColumn(
        'timeline_todos',
        new TableColumn({
          name: 'createdAt',
          type: 'timestamp',
          default: 'now()',
          isNullable: false,
        }),
      );
    }

    // Check if modifiedAt column exists, if not add it
    const hasModifiedAt = await queryRunner.hasColumn('timeline_todos', 'modifiedAt');
    if (!hasModifiedAt) {
      await queryRunner.addColumn(
        'timeline_todos',
        new TableColumn({
          name: 'modifiedAt',
          type: 'timestamp',
          default: 'now()',
          onUpdate: 'now()',
          isNullable: false,
        }),
      );
    }
  }

  async down(queryRunner) {
    const hasModifiedAt = await queryRunner.hasColumn('timeline_todos', 'modifiedAt');
    if (hasModifiedAt) {
      await queryRunner.dropColumn('timeline_todos', 'modifiedAt');
    }

    const hasCreatedAt = await queryRunner.hasColumn('timeline_todos', 'createdAt');
    if (hasCreatedAt) {
      await queryRunner.dropColumn('timeline_todos', 'createdAt');
    }
  }
};