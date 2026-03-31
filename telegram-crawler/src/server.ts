import mongoose from "mongoose";
import { app } from "./app";
import { env } from "./config/env.js";
import { startDailyCrawlScheduler } from "./modules/message-crawler/crawl.scheduler.js";

async function bootstrap() {
  await mongoose.connect(env.mongoUri);
  console.log("MongoDB connected");

  app.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });

  startDailyCrawlScheduler();
}

bootstrap().catch((error) => {
  console.error("Bootstrap error", error);
  process.exit(1);
});