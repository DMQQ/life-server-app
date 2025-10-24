"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTodoFiles1761292996412 = void 0;
const typeorm_1 = require("typeorm");
class AddTodoFiles1761292996412 {
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
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
        }));
        await queryRunner.createForeignKey('todo_files', new typeorm_1.ForeignKey({
            columnNames: ['todoId'],
            referencedColumnNames: ['id'],
            referencedTableName: 'timeline_todos',
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
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
exports.AddTodoFiles1761292996412 = AddTodoFiles1761292996412;
//# sourceMappingURL=1761292996412-AddTodoFiles.js.map