import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import importGithubRouter from "./import-github";
import filesRouter from "./files";
import execRouter from "./exec";
import aiRouter from "./ai";
import githubRouter from "./github";
import settingsRouter from "./settings";
import previewRouter from "./preview";
import devServerRouter from "./dev-server";

const router: IRouter = Router();

router.use(healthRouter);
router.use(importGithubRouter);
router.use(projectsRouter);
router.use(filesRouter);
router.use(execRouter);
router.use(aiRouter);
router.use(githubRouter);
router.use(settingsRouter);
router.use(previewRouter);
router.use(devServerRouter);

export default router;
