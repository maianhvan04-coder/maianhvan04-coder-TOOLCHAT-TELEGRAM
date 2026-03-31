import { InferSchemaType, Schema, model } from "mongoose";

const crawlJobSchema = new Schema(
  {
    chatId: {
      type: String,
      required: true,
      index: true
    },

    dayKey: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["PENDING", "RUNNING", "SUCCESS", "FAILED"],
      default: "PENDING",
      index: true
    },

    totalFetched: {
      type: Number,
      default: 0
    },

    errorMessage: {
      type: String,
      default: null
    },

    startedAt: {
      type: Date,
      default: null
    },

    finishedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

crawlJobSchema.index({ chatId: 1, dayKey: 1 }, { unique: true });

export type CrawlJobDoc = InferSchemaType<typeof crawlJobSchema>;
export const CrawlJobModel = model("CrawlJob", crawlJobSchema);