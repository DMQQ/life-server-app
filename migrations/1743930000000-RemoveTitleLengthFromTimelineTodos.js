const typeorm = require('typeorm');

module.exports = class RemoveTitleLengthFromTimelineTodos1743930000000 {
  async up(queryRunner) {
    // Remove length constraint from title column in timeline_todos
    await queryRunner.query(`ALTER TABLE timeline_todos MODIFY COLUMN title VARCHAR(512)`);
  }

  async down(queryRunner) {
    // Restore the original length constraint
    await queryRunner.query(`ALTER TABLE timeline_todos MODIFY COLUMN title VARCHAR(100)`);
  }
};
