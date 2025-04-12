// import { MigrationInterface, QueryRunner } from 'typeorm';

// export class AddSubexpenses1744452722129 {
//   async up(queryRunner) {
//     // Create the expense_subexpenses table with MySQL syntax
//     await queryRunner.query(`
//       CREATE TABLE expense_subexpenses (
//         id VARCHAR(36) PRIMARY KEY,
//         description VARCHAR(255) NOT NULL,
//         amount FLOAT NOT NULL,
//         category VARCHAR(255) NOT NULL,
//         expenseId VARCHAR(36) NOT NULL,
//         CONSTRAINT fk_expense_subexpenses_expense
//           FOREIGN KEY (expenseId)
//           REFERENCES expense(id)
//           ON DELETE CASCADE
//       )
//     `);
//   }

//   async down(queryRunner) {
//     // Drop the table in the down migration
//     await queryRunner.query(`
//       DROP TABLE expense_subexpenses;
//     `);
//   }
// }
