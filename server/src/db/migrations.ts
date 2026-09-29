import type { DatabaseSync } from "node:sqlite";

const migrations = [
  {
    version: 1,
    sql: `
      CREATE TABLE tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL
          CHECK (length(title) BETWEEN 1 AND 120 AND title = trim(title)),
        description TEXT NOT NULL DEFAULT ''
          CHECK (length(description) <= 2000),
        status TEXT NOT NULL DEFAULT 'TODO'
          CHECK (status IN ('TODO', 'IN_PROGRESS', 'DONE')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE INDEX idx_tasks_created_at
        ON tasks(created_at DESC, id DESC);

      CREATE INDEX idx_tasks_status_created_at
        ON tasks(status, created_at DESC, id DESC);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE tasks ADD COLUMN due_date TEXT
        CHECK (
          due_date IS NULL OR (
            length(due_date) = 10 AND
            due_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'
          )
        );

      CREATE INDEX idx_tasks_due_date_status
        ON tasks(due_date, status, created_at DESC, id DESC);
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE tasks ADD COLUMN priority TEXT NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH'));

      CREATE TABLE tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL COLLATE NOCASE UNIQUE
          CHECK (
            length(name) BETWEEN 1 AND 30 AND
            name = trim(name) AND
            instr(name, ',') = 0
          )
      ) STRICT;

      CREATE TABLE task_tags (
        task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (task_id, tag_id)
      ) STRICT;

      CREATE INDEX idx_tasks_priority_created_at
        ON tasks(priority, created_at DESC, id DESC);

      CREATE INDEX idx_tasks_updated_at
        ON tasks(updated_at DESC, id DESC);

      CREATE INDEX idx_task_tags_tag_task
        ON task_tags(tag_id, task_id);
    `,
  },
] as const;

export function runMigrations(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const appliedRows = database
    .prepare("SELECT version FROM schema_migrations")
    .all() as Array<{ version: number }>;
  const applied = new Set(appliedRows.map((row) => row.version));
  const recordMigration = database.prepare(
    "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(migration.sql);
      recordMigration.run(migration.version, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}
