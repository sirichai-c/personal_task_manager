import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
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

async function startServer(databasePath = join(testDirectory, "tasks.sqlite")): Promise<TestServer> {
  const application = createApplication({ databasePath });
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

async function createTask(server: TestServer, title: string, description = "") {
  return request<{ item: { id: number; title: string; description: string; status: string } }>(
    server,
    "/api/tasks",
    {
      method: "POST",
      body: JSON.stringify({ title, description }),
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
    });
  });

  it.each([
    [{ title: "   " }, "title"],
    [{ title: "ก".repeat(121) }, "title"],
    [{ title: "งาน", description: "ก".repeat(2_001) }, "description"],
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

  it("edits all fields and allows status to move backwards", async () => {
    const server = await startServer();
    const created = await createTask(server, "งานเดิม");
    const id = created.body.item.id;

    for (const status of ["IN_PROGRESS", "DONE", "TODO"]) {
      const response = await request<{ item: { title: string; description: string; status: string } }>(
        server,
        `/api/tasks/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            title: "งานที่แก้แล้ว",
            description: "รายละเอียดใหม่",
            status,
          }),
        },
      );
      expect(response.status).toBe(200);
      expect(response.body.item.status).toBe(status);
    }
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
    const created = await createTask(server, "งานที่จะลบ");
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
  });

  it("keeps tasks after the database is closed and reopened", async () => {
    const databasePath = join(testDirectory, "persistent.sqlite");
    const firstServer = await startServer(databasePath);
    const created = await createTask(firstServer, "งานที่ต้องอยู่ต่อ");
    await stopServer(firstServer);

    const restartedServer = await startServer(databasePath);
    const list = await request<{ items: Array<{ id: number; title: string }> }>(
      restartedServer,
      "/api/tasks",
    );

    expect(list.status).toBe(200);
    expect(list.body.items).toContainEqual(
      expect.objectContaining({ id: created.body.item.id, title: "งานที่ต้องอยู่ต่อ" }),
    );
  });
});

