import cron from "node-cron";
import { env } from "../../config/env.js";
import { getTodayDayKey } from "../../shared/utils/day.js";
import { crawlerService } from "./crawler.service.js";

export function startDailyCrawlScheduler() {
  cron.schedule(
    "5 0 * * *",
    async () => {
      const dayKey = getTodayDayKey(env.dayTzOffsetMinutes);

      try {
        const results = await crawlerService.runAllActive(dayKey);
        console.log("[daily-crawl] success", { dayKey, results });
      } catch (error) {
        console.error("[daily-crawl] error", error);
      }
    },
    {
      timezone: env.cronTimezone
    }
  );
}