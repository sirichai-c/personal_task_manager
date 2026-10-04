import { Router } from "express";
import { TaskController } from "../controllers/task-controller.js";

export function createTaskRouter(controller: TaskController): Router {
  const router = Router();
  router.get("/", controller.list);
  router.post("/", controller.create);
  router.post("/:id/subtasks", controller.createSubtask);
  router.patch("/:id/subtasks/:subtaskId", controller.updateSubtask);
  router.delete("/:id/subtasks/:subtaskId", controller.deleteSubtask);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.delete);
  return router;
}
