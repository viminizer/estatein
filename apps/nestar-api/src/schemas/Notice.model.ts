import mongoose, { Schema } from "mongoose";
import { NoticeCategory, NoticeStatus } from "../libs/enums/notice.enum";

const NoticeSchema = new Schema(
  {
    noticeCategory: {
      type: String,
      enum: NoticeCategory,
      required: true,
    },

    noticeStatus: {
      type: String,
      enum: NoticeStatus,
      default: NoticeStatus.ACTIVE,
    },

    noticeTitle: {
      type: String,
    },

    noticeContent: {
      type: String,
    },

    content: {
      type: String,
    },

    subject: {
      type: String,
    },

    memberId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Member",
    },
  },
  { timestamps: true, collection: "notices" },
);

export default NoticeSchema;
