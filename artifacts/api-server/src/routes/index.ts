import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import dashboardRouter from "./dashboard";
import galleryRouter from "./gallery";
import generateRouter from "./generate";
import creditsRouter from "./credits";
import providersRouter from "./providers";
import adminRouter from "./admin";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use(meRouter);
router.use(dashboardRouter);
router.use(galleryRouter);
router.use(generateRouter);
router.use(creditsRouter);
router.use(providersRouter);
router.use(adminRouter);
router.use(storageRouter);

export default router;
