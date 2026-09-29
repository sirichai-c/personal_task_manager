import { resolve } from "node:path";
import { openDatabase } from "../db/database.js";

const databasePath = resolve(process.env.TASK_DB_PATH ?? resolve(process.cwd(), "data/tasks.sqlite"));
const database = openDatabase(databasePath);
database.close();
console.log(`Database is ready: ${databasePath}`);
