module.exports = class CreateExpenseCorrectionMap1761500000000 {
  name = 'CreateExpenseCorrectionMap1761500000000';

  async up(queryRunner) {
    await queryRunner.query(`
      CREATE TABLE \`expense_correction_map\` (
        \`id\`                  VARCHAR(36)    NOT NULL,
        \`walletId\`            VARCHAR(36)    NOT NULL,
        \`matchShop\`           VARCHAR(255)   NULL,
        \`matchDescription\`    VARCHAR(255)   NULL,
        \`matchCategory\`       VARCHAR(255)   NULL,
        \`matchAmountMin\`      FLOAT          NULL,
        \`matchAmountMax\`      FLOAT          NULL,
        \`overrideShop\`        VARCHAR(255)   NULL,
        \`overrideCategory\`    VARCHAR(255)   NULL,
        \`overrideDescription\` VARCHAR(255)   NULL,
        \`isActive\`            TINYINT(1)     NOT NULL DEFAULT 1,
        \`createdAt\`           DATETIME(6)    NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_correction_map_wallet\`
          FOREIGN KEY (\`walletId\`)
          REFERENCES \`wallet\` (\`id\`)
          ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner) {
    await queryRunner.query(`DROP TABLE \`expense_correction_map\``);
  }
};
