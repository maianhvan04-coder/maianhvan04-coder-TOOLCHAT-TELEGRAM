import { InferSchemaType, Schema, model } from "mongoose";

export type TrackedGroupType = "PUBLIC" | "PRIVATE";

const trackedGroupSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    chatId: {
      type: String,
      required: true,
      index: true,
    },

    ownerTelegramUserId: {
      type: String,
      required: true,
      index: true,
    },

    ownerTelegramUsername: {
      type: String,
      default: null,
    },

    ownerTelegramPhone: {
      type: String,
      default: null,
    },

    username: {
      type: String,
      default: null,
    },

    inviteLink: {
      type: String,
      default: null,
    },

    type: {
      type: String,
      enum: ["PUBLIC", "PRIVATE"],
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    lastCrawledDay: {
      type: String,
      default: null,
    },

    meta: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

trackedGroupSchema.index(
  { ownerTelegramUserId: 1, chatId: 1 },
  { unique: true }
);

export type TrackedGroupDoc = InferSchemaType<typeof trackedGroupSchema>;
export const TrackedGroupModel = model("TrackedGroup", trackedGroupSchema);