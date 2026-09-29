import { mkdtempSync, rmSync } from "node:fs";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createApplication } from "../app.js";
import { openDatabase } from "../db/database.js";
import { TaskRepository } from "../db/task-repository.js";
import type { TaskStatus } from "../domain/task.js";

const SAMPLE_SIZE = 5_000;
const RUNS = 20;
const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

function percentile(sorted: number[], fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return sorted[index] ?? 0;
}

function summarize(values: number[]) {
  const sorted = values.toSorted((left, right) => left - right);
  return {
    minMs: Number((sorted[0] ?? 0).toFixed(2)),
    medianMs: Number(percentile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
    maxMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
  };
}

async function measure(url: string): Promise<number[]> {
  const samples: number[] = [];
  await fetch(url);
  for (let index = 0; index < RUNS; index += 1) {
    const startedAt = performance.now();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Performance request failed with ${response.status}`);
    }
    await response.text();
    samples.push(performance.now() - startedAt);
  }
  return samples;
}

const testDirectory = mkdtempSync(join(tmpdir(), "personal-tasks-performance-"));
const databasePath = join(testDirectory, "performance.sqlite");

try {
  const database = openDatabase(databasePath);
  const repository = new TaskRepository(database);
  database.exec("BEGIN IMMEDIATE");
  try {
    for (let index = 1; index <= SAMPLE_SIZE; index += 1) {
      repository.create({
        title: index % 10 === 0 ? `รายงานประจำวัน ${index}` : `งานตัวอย่าง ${index}`,
        description: `ข้อมูลทดสอบลำดับที่ ${index}`,
        status: statuses[index % statuses.length] ?? "TODO",
        dueDate: null,
        now: new Date(Date.UTC(2026, 0, 1, 0, 0, index)).toISOString(),
      });
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }

  const application = createApplication({ databasePath });
  const server = application.app.listen(0, "127.0.0.1");
  if (!server.listening) {
    await once(server, "listening");
  }
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Performance server did not bind to a TCP port");
  }
  const origin = `http://127.0.0.1:${address.port}`;

  const listSamples = await measure(`${origin}/api/tasks?page=1`);
  const searchSamples = await measure(
    `${origin}/api/tasks?search=${encodeURIComponent("รายงาน")}&status=DONE&page=1`,
  );

  console.log(
    JSON.stringify(
      {
        environment: {
          platform: `${process.platform} ${process.arch}`,
          node: process.version,
          rows: SAMPLE_SIZE,
          requestsPerScenario: RUNS,
          transport: "HTTP loopback",
        },
        listPage: summarize(listSamples),
        searchAndFilter: summarize(searchSamples),
      },
      null,
      2,
    ),
  );

  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  application.close();
} finally {
  rmSync(testDirectory, { recursive: true, force: true });
}
