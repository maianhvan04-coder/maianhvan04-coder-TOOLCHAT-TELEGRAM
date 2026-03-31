import { InferSchemaType, Schema, model } from "mongoose";

const telegramMessageSchema = new Schema(
  {
    chatId: {
      type: String,
      required: true,
      index: true
    },

    messageId: {
      type: String,
      required: true
    },

    date: {
      type: Number,
      required: true,
      index: true
    },

    dayKey: {
      type: String,
      required: true,
      index: true
    },

    senderId: {
      type: String,
      default: null,
      index: true
    },

    senderType: {
      type: String,
      default: null
    },

    senderName: {
      type: String,
      default: null
    },

    text: {
      type: String,
      default: ""
    },

    hasMedia: {
      type: Boolean,
      default: false
    },

    mediaType: {
      type: String,
      default: null
    },

    raw: {
      type: Schema.Types.Mixed,
      required: true
    }
  },
  {
    timestamps: true
  }
);

telegramMessageSchema.index({ chatId: 1, messageId: 1 }, { unique: true });
telegramMessageSchema.index({ chatId: 1, dayKey: 1, date: 1 });

export type TelegramMessageDoc = InferSchemaType<typeof telegramMessageSchema>;
export const TelegramMessageModel = model(
  "TelegramMessage",
  telegramMessageSchema
);