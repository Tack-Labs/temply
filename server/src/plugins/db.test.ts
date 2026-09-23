import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { initTables } from './db';

describe('initTables', () => {
  it('renumbers versions that share a number before the unique index is built, and keeps every one', () => {
    const sqlite = new Database(':memory:');
    // The table as an install from before the index has it.
    sqlite.run(`CREATE TABLE template_versions (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL, user_id TEXT NOT NULL,
      title TEXT NOT NULL, preview_text TEXT, content TEXT NOT NULL,
      version_number INTEGER NOT NULL, created_at TEXT DEFAULT (datetime('now'))
    )`);
    const insert = sqlite.prepare(
      `INSERT INTO template_versions (id, template_id, user_id, title, content, version_number) VALUES (?, ?, 'u', 't', '{}', ?)`,
    );
    for (const [id, template, number] of [
      ['a1', 'a', 1],
      ['a2', 'a', 2],
      ['a2-again', 'a', 2],
      ['a3', 'a', 3],
      ['a3-again', 'a', 3],
      ['b1', 'b', 1],
    ] as const) insert.run(id, template, number);

    initTables(sqlite);
    initTables(sqlite);

    const rows = sqlite.query(`SELECT id, version_number FROM template_versions ORDER BY id`).all();
    expect(rows).toEqual([
      { id: 'a1', version_number: 1 },
      { id: 'a2', version_number: 2 },
      { id: 'a2-again', version_number: 4 },
      { id: 'a3', version_number: 3 },
      { id: 'a3-again', version_number: 5 },
      { id: 'b1', version_number: 1 },
    ]);
    expect(() => insert.run('a5-again', 'a', 5)).toThrow(/UNIQUE/);
  });
});
