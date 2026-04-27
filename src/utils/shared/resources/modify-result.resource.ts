import { DeleteResult, InsertResult, UpdateResult } from 'typeorm';

export default class ModifyResult {
  constructor(private input: InsertResult | DeleteResult | UpdateResult) {}

  toBoolean() {
    if ('affected' in this.input) {
      return this.input.affected > 0;
    }
    if ('raw' in this.input) {
      return this.input.raw.affectedRows > 0;
    }
    return false;
  }
}
