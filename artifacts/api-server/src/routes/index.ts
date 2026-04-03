import { Router, type IRouter } from "express";
import healthRouter from "./health";
import projectsRouter from "./projects";
import filesRouter from "./files";
import aiRouter from "./ai";
import githubRouter from "./github";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(projectsRouter);
router.use(filesRouter);
router.use(aiRouter);
router.use(githubRouter);
router.use(settingsRouter);

export default router;
