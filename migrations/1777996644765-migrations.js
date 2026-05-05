"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migrations1777996644765 = void 0;
const typeorm_1 = require("typeorm");
class Migrations1777996644765 {
    async up(queryRunner) {
        await queryRunner.addColumn('subscriptions', new typeorm_1.TableColumn({
            name: 'subAccountId',
            type: 'varchar',
            length: '36',
            isNullable: true,
            default: null,
        }));
        await queryRunner.createForeignKey('subscriptions', new typeorm_1.TableForeignKey({
            columnNames: ['subAccountId'],
            referencedTableName: 'wallet_sub_account',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
        }));
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('subscriptions');
        const fk = table.foreignKeys.find((k) => k.columnNames.includes('subAccountId'));
        if (fk) await queryRunner.dropForeignKey('subscriptions', fk);
        await queryRunner.dropColumn('subscriptions', 'subAccountId');
    }
}
exports.Migrations1777996644765 = Migrations1777996644765;
//# sourceMappingURL=1777996644765-migrations.js.map
