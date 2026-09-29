import { resolve } from "node:path";
import { loadLocalEnvironment } from "../config/environment.js";
import { openDatabase } from "../db/database.js";

loadLocalEnvironment();

const databasePath = resolve(process.env.TASK_DB_PATH ?? resolve(process.cwd(), "data/tasks.sqlite"));
const database = openDatabase(databasePath);
database.close();
console.log(`Database is ready: ${databasePath}`);
