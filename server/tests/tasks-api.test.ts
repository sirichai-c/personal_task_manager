import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApplication, type ApplicationHandle } from "../src/app.js";

interface TestServer {
  application: ApplicationHandle;
  server: Server;
  origin: string;
  closed: boolean;
}

interface ApiResponse<T> {
  status: number;
  body: T;
}

let testDirectory: string;
let runningServers: TestServer[];

async function startServer(
  databasePath = join(testDirectory, "tasks.sqlite"),
  now?: () => Date,
): Promise<TestServer> {
  const application = createApplication({ databasePath, ...(now ? { now } : {}) });
  const server = application.app.listen(0, "127.0.0.1");
  if (!server.listening) {
    await once(server, "listening");
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Test server did not bind to a TCP port");
  }

  const testServer: TestServer = {
    application,
    server,
    origin: `http://127.0.0.1:${address.port}`,
    closed: false,
  };
  runningServers.push(testServer);
  return testServer;
}

async function stopServer(testServer: TestServer): Promise<void> {
  if (testServer.closed) {
    return;
  }
  testServer.closed = true;
  await new Promise<void>((resolve, reject) => {
    testServer.server.close((error) => (error ? reject(error) : resolve()));
  });
  testServer.application.close();
}

async function request<T>(
  server: TestServer,
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const response = await fetch(`${server.origin}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const body = response.status === 204 ? undefined : await response.json();
  return { status: response.status, body: body as T };
}

async function createTask(
  server: TestServer,
  title: string,
  description = "",
  dueDate?: string | null,
  priority?: "LOW" | "NORMAL" | "HIGH",
  tags?: string[],
) {
  return request<{
    item: {
      id: number;
      title: string;
      description: string;
      status: string;
      dueDate: string | null;
      priority: string;
      tags: string[];
    };
  }>(
    server,
    "/api/tasks",
    {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        ...(dueDate !== undefined ? { dueDate } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(tags !== undefined ? { tags } : {}),
      }),
    },
  );
}

beforeEach(async () => {
  testDirectory = await mkdtemp(join(tmpdir(), "personal-tasks-test-"));
  runningServers = [];
});

afterEach(async () => {
  for (const server of runningServers.toReversed()) {
    await stopServer(server);
  }
  await rm(testDirectory, { recursive: true, force: true });
});

describe("tasks API", () => {
  it("creates a trimmed task with TODO status", async () => {
    const server = await startServer();
    const response = await createTask(server, "  เตรียมรายงาน  ", "สรุปประจำสัปดาห์");

    expect(response.status).toBe(201);
    expect(response.body.item).toMatchObject({
      title: "เตรียมรายงาน",
      description: "สรุปประจำสัปดาห์",
      status: "TODO",
      dueDate: null,
      priority: "NORMAL",
      tags: [],
    });
  });

  it("creates a task with an optional due date", async () => {
    const server = await startServer();
    const response = await createTask(server, "ส่งรายงาน", "", "2026-10-05");

    expect(response.status).toBe(201);
    expect(response.body.item.dueDate).toBe("2026-10-05");
  });

  it.each([
    [{ title: "   " }, "title"],
    [{ title: "ก".repeat(121) }, "title"],
    [{ title: "งาน", description: "ก".repeat(2_001) }, "description"],
    [{ title: "งาน", dueDate: "2026-02-30" }, "dueDate"],
    [{ title: "งาน", priority: "URGENT" }, "priority"],
    [{ title: "งาน", tags: "ด่วน" }, "tags"],
    [{ title: "งาน", tags: Array.from({ length: 11 }, (_, index) => `แท็ก ${index}`) }, "tags"],
    [{ title: "งาน", tags: ["ก".repeat(31)] }, "tags"],
  ])("rejects invalid create input %#", async (payload, field) => {
    const server = await startServer();
    const response = await request<{ error: { fields: Record<string, string> } }>(
      server,
      "/api/tasks",
      { method: "POST", body: JSON.stringify(payload) },
    );

    expect(response.status).toBe(400);
    expect(response.body.error.fields[field]).toBeTruthy();
  });

  it("creates and edits priority and normalized unique tags", async () => {
    const server = await startServer();
    const created = await createTask(
      server,
      "เตรียมประชุม",
      "",
      null,
      "HIGH",
      [" งาน ", "Work", "work", "ด่วน"],
    );

    expect(created.status).toBe(201);
    expect(created.body.item.priority).toBe("HIGH");
    expect(created.body.item.tags).toHaveLength(3);
    expect(created.body.item.tags).toEqual(expect.arrayContaining(["งาน", "Work", "ด่วน"]));

    const updated = await request<{
      item: { priority: string; tags: string[] };
    }>(server, `/api/tasks/${created.body.item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ priority: "LOW", tags: ["ส่วนตัว"] }),
    });

    expect(updated.status).toBe(200);
    expect(updated.body.item).toMatchObject({ priority: "LOW", tags: ["ส่วนตัว"] });
  });

  it("rejects an invalid status", async () => {
    const server = await startServer();
    const created = await createTask(server, "งานทดสอบ");
    const response = await request<{ error: { code: string } }>(
      server,
      `/api/tasks/${created.body.item.id}`,
      { method: "PATCH", body: JSON.stringify({ status: "WAITING" }) },
    );

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns newest tasks first and paginates at 20 items", async () => {
    const server = await startServer();
    for (let index = 1; index <= 25; index += 1) {
      await createTask(server, `งาน ${index}`);
    }

    const firstPage = await request<{
      items: Array<{ id: number; title: string }>;
      pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
    }>(server, "/api/tasks?page=1");
    const secondPage = await request<{ items: Array<{ id: number }> }>(server, "/api/tasks?page=2");

    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(20);
    expect(firstPage.body.items[0]?.title).toBe("งาน 25");
    expect(firstPage.body.pagination).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 25,
      totalPages: 2,
    });
    expect(secondPage.body.items).toHaveLength(5);
    expect(secondPage.body.items[0]?.id).toBeLessThan(firstPage.body.items.at(-1)?.id ?? 0);
  });

  it("combines title search and status filter", async () => {
    const server = await startServer();
    await createTask(server, "สรุปรายงานเดือนนี้");
    const matching = await createTask(server, "ตรวจรายงานลูกค้า");
    const other = await createTask(server, "โทรหาลูกค้า");

    for (const id of [matching.body.item.id, other.body.item.id]) {
      await request(server, `/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      });
    }

    const response = await request<{
      items: Array<{ id: number }>;
      pagination: { totalItems: number };
    }>(server, "/api/tasks?search=%E0%B8%A3%E0%B8%B2%E0%B8%A2%E0%B8%87%E0%B8%B2%E0%B8%99&status=DONE");

    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.id)).toEqual([matching.body.item.id]);
    expect(response.body.pagination.totalItems).toBe(1);
  });

  it("combines search, status, priority, and exact tag filters", async () => {
    const server = await startServer();
    const matching = await createTask(
      server,
      "ตรวจรายงานด่วน",
      "",
      null,
      "HIGH",
      ["ลูกค้า", "ด่วน"],
    );
    const wrongPriority = await createTask(
      server,
      "ตรวจรายงานทั่วไป",
      "",
      null,
      "NORMAL",
      ["ด่วน"],
    );
    await createTask(server, "โทรหาลูกค้า", "", null, "HIGH", ["ด่วน"]);
    for (const id of [matching.body.item.id, wrongPriority.body.item.id]) {
      await request(server, `/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      });
    }

    const query = new URLSearchParams({
      search: "รายงาน",
      status: "DONE",
      priority: "HIGH",
      tag: "ด่วน",
    });
    const response = await request<{
      items: Array<{ id: number }>;
      pagination: { totalItems: number };
    }>(server, `/api/tasks?${query.toString()}`);

    expect(response.status).toBe(200);
    expect(response.body.items.map((item) => item.id)).toEqual([matching.body.item.id]);
    expect(response.body.pagination.totalItems).toBe(1);
  });

  it("sorts by creation, update, due date, and priority with stable tie-breakers", async () => {
    let currentTime = "2026-09-30T08:00:00.000Z";
    const server = await startServer(
      join(testDirectory, "sorting.sqlite"),
      () => new Date(currentTime),
    );
    const normal = await createTask(server, "ปกติไม่มีวัน", "", null, "NORMAL");
    currentTime = "2026-09-30T09:00:00.000Z";
    const low = await createTask(server, "ต่ำใกล้สุด", "", "2026-10-05", "LOW");
    currentTime = "2026-09-30T10:00:00.000Z";
    const high = await createTask(server, "สูงถัดไป", "", "2026-10-10", "HIGH");

    const listIds = async (sort: string) => {
      const response = await request<{ items: Array<{ id: number }> }>(
        server,
        `/api/tasks?sort=${sort}`,
      );
      expect(response.status).toBe(200);
      return response.body.items.map((item) => item.id);
    };

    await expect(listIds("CREATED_DESC")).resolves.toEqual([
      high.body.item.id,
      low.body.item.id,
      normal.body.item.id,
    ]);
    await expect(listIds("DUE_ASC")).resolves.toEqual([
      low.body.item.id,
      high.body.item.id,
      normal.body.item.id,
    ]);
    await expect(listIds("PRIORITY_DESC")).resolves.toEqual([
      high.body.item.id,
      normal.body.item.id,
      low.body.item.id,
    ]);

    currentTime = "2026-09-30T11:00:00.000Z";
    await request(server, `/api/tasks/${normal.body.item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ description: "แก้ไขล่าสุด" }),
    });
    await expect(listIds("UPDATED_DESC")).resolves.toEqual([
      normal.body.item.id,
      high.body.item.id,
      low.body.item.id,
    ]);
  });

  it("filters due dates using a Monday-to-Sunday week and excludes completed overdue work", async () => {
    const databasePath = join(testDirectory, "due-date-filters.sqlite");
    const server = await startServer(databasePath, () => new Date("2026-09-30T12:00:00.000Z"));
    const today = await createTask(server, "ครบวันนี้", "", "2026-09-30");
    const week = await createTask(server, "ครบปลายสัปดาห์", "", "2026-10-04");
    const overdue = await createTask(server, "งานเกินกำหนด", "", "2026-09-29");
    const completedOverdue = await createTask(server, "งานเก่าที่เสร็จแล้ว", "", "2026-09-28");
    const withoutDate = await createTask(server, "งานไม่กำหนดวัน");
    await request(server, `/api/tasks/${completedOverdue.body.item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "DONE" }),
    });

    const listIds = async (query: string) => {
      const response = await request<{ items: Array<{ id: number }> }>(
        server,
        `/api/tasks?${query}`,
      );
      expect(response.status).toBe(200);
      return response.body.items.map((item) => item.id);
    };

    await expect(listIds("dueDate=TODAY")).resolves.toEqual([today.body.item.id]);
    await expect(listIds("dueDate=THIS_WEEK")).resolves.toEqual([
      completedOverdue.body.item.id,
      overdue.body.item.id,
      week.body.item.id,
      today.body.item.id,
    ]);
    await expect(listIds("dueDate=OVERDUE")).resolves.toEqual([overdue.body.item.id]);
    await expect(listIds("dueDate=NO_DATE")).resolves.toEqual([withoutDate.body.item.id]);
    await expect(
      listIds(
        "search=%E0%B9%80%E0%B8%81%E0%B8%B4%E0%B8%99&status=TODO&dueDate=OVERDUE&referenceDate=2026-09-30",
      ),
    ).resolves.toEqual([overdue.body.item.id]);
  });

  it.each([
    ["dueDate=NEXT_MONTH", "dueDate"],
    ["dueDate=TODAY&referenceDate=2026-02-30", "referenceDate"],
    ["priority=URGENT", "priority"],
    ["sort=TITLE_ASC", "sort"],
    ["tag=%20", "tags"],
  ])("rejects invalid due-date query %#", async (query, field) => {
    const server = await startServer();
    const response = await request<{ error: { fields: Record<string, string> } }>(
      server,
      `/api/tasks?${query}`,
    );

    expect(response.status).toBe(400);
    expect(response.body.error.fields[field]).toBeTruthy();
  });

  it("edits all fields, clears a due date, and allows status to move backwards", async () => {
    const server = await startServer();
    const created = await createTask(server, "งานเดิม");
    const id = created.body.item.id;

    for (const status of ["IN_PROGRESS", "DONE", "TODO"]) {
      const response = await request<{
        item: { title: string; description: string; status: string; dueDate: string | null };
      }>(
        server,
        `/api/tasks/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "งานที่แก้แล้ว",
            description: "รายละเอียดใหม่",
            status,
            dueDate: "2026-10-05",
          }),
        },
      );
      expect(response.status).toBe(200);
      expect(response.body.item.status).toBe(status);
      expect(response.body.item.dueDate).toBe("2026-10-05");
    }

    const cleared = await request<{ item: { dueDate: string | null } }>(
      server,
      `/api/tasks/${id}`,
      { method: "PATCH", body: JSON.stringify({ dueDate: null }) },
    );
    expect(cleared.status).toBe(200);
    expect(cleared.body.item.dueDate).toBeNull();
  });

  it("returns 404 for an unknown id without a stack trace", async () => {
    const server = await startServer();
    const update = await request<{ error: Record<string, unknown> }>(server, "/api/tasks/999999", {
      method: "PATCH",
      body: JSON.stringify({ title: "ไม่พบ" }),
    });
    const deletion = await request<{ error: Record<string, unknown> }>(server, "/api/tasks/999999", {
      method: "DELETE",
    });

    expect(update.status).toBe(404);
    expect(deletion.status).toBe(404);
    expect(JSON.stringify(update.body)).not.toContain("stack");
  });

  it("deletes an existing task", async () => {
    const server = await startServer();
    const created = await createTask(server, "งานที่จะลบ", "", null, "NORMAL", ["ชั่วคราว"]);
    const deletion = await request(server, `/api/tasks/${created.body.item.id}`, {
      method: "DELETE",
    });
    const list = await request<{ items: unknown[]; pagination: { totalItems: number } }>(
      server,
      "/api/tasks",
    );

    expect(deletion.status).toBe(204);
    expect(list.body.items).toHaveLength(0);
    expect(list.body.pagination.totalItems).toBe(0);
    const remainingTags = server.application.database
      .prepare("SELECT COUNT(*) AS count FROM tags")
      .get() as { count: number };
    expect(remainingTags.count).toBe(0);
  });

  it("keeps tasks after the database is closed and reopened", async () => {
    const databasePath = join(testDirectory, "persistent.sqlite");
    const firstServer = await startServer(databasePath);
    const created = await createTask(
      firstServer,
      "งานที่ต้องอยู่ต่อ",
      "",
      null,
      "HIGH",
      ["ถาวร"],
    );
    await stopServer(firstServer);

    const restartedServer = await startServer(databasePath);
    const list = await request<{
      items: Array<{ id: number; title: string; priority: string; tags: string[] }>;
    }>(
      restartedServer,
      "/api/tasks",
    );

    expect(list.status).toBe(200);
    expect(list.body.items).toContainEqual(
      expect.objectContaining({
        id: created.body.item.id,
        title: "งานที่ต้องอยู่ต่อ",
        priority: "HIGH",
        tags: ["ถาวร"],
      }),
    );
  });

  it("migrates an existing version-1 database without losing tasks", async () => {
    const databasePath = join(testDirectory, "legacy.sqlite");
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO schema_migrations (version, applied_at)
        VALUES (1, '2026-09-29T00:00:00.000Z');
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
      INSERT INTO tasks (title, description, status, created_at, updated_at)
        VALUES ('งานจาก schema เดิม', '', 'TODO', '2026-09-29T00:00:00.000Z', '2026-09-29T00:00:00.000Z');
    `);
    legacyDatabase.close();

    const server = await startServer(databasePath);
    const list = await request<{
      items: Array<{
        title: string;
        dueDate: string | null;
        priority: string;
        tags: string[];
      }>;
    }>(
      server,
      "/api/tasks",
    );
    const migrations = server.application.database
      .prepare("SELECT version FROM schema_migrations ORDER BY version")
      .all() as Array<{ version: number }>;

    expect(list.status).toBe(200);
    expect(list.body.items).toContainEqual(
      expect.objectContaining({
        title: "งานจาก schema เดิม",
        dueDate: null,
        priority: "NORMAL",
        tags: [],
      }),
    );
    expect(migrations.map((migration) => migration.version)).toEqual([1, 2, 3]);
  });
});
