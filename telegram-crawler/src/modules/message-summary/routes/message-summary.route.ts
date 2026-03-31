import { Router } from "express";
import { messageSummaryController } from "../controller/message-summary.controller.js";

export const messageSummaryRouter = Router();

messageSummaryRouter.post("/summary", messageSummaryController.summarizeDay);