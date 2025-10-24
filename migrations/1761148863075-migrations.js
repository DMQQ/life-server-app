"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Migrations1761148863075 = void 0;
const typeorm_1 = require("typeorm");
class Migrations1761148863075 {
    async up(queryRunner) {
        await queryRunner.addColumn('wallet', new typeorm_1.TableColumn({
            name: 'paycheckDate',
            type: 'varchar',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropColumn('wallet', 'paycheckDate');
    }
}
exports.Migrations1761148863075 = Migrations1761148863075;
//# sourceMappingURL=1761148863075-migrations.js.map