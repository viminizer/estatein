import { Field, InputType } from "@nestjs/graphql";
import { ObjectId } from "mongoose";
import { NoticeCategory } from "../../enums/notice.enum";

@InputType()
export class NoticeInput {
  @Field(() => NoticeCategory)
  noticeCategory: NoticeCategory;

  @Field(() => String)
  noticeTitle: string;

  @Field(() => String)
  noticeContent: string;

  @Field(() => String)
  memberId: ObjectId;
}
