import { Args, Mutation, Resolver } from "@nestjs/graphql";
import { NoticeService } from "./notice.service";
import { Notice, Notices } from "../../libs/dto/notice/notice";
import { MemberType } from "../../libs/enums/member.enum";
import { UseGuards } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { NoticeInput } from "../../libs/dto/notice/notice.input";
import { ObjectId } from "mongoose";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuthMember } from "../auth/decorators/authMember.decorator";
import { WithoutGuard } from "../auth/guards/without.guard";

@Resolver()
export class NoticeResolver {
  constructor(private readonly noticeService: NoticeService) { }

  @Roles(MemberType.ADMIN)
  @UseGuards(RolesGuard)
  @Mutation(() => Notice)
  public async createNotice(
    @Args("input") input: NoticeInput,
    @AuthMember("_id") memberId: ObjectId,
  ): Promise<Notice> {
    return await this.noticeService.createNotice(memberId, input);
  }

  @UseGuards(WithoutGuard)
  @Mutation(() => Notices)
  public async getNotices(
    @AuthMember("_id") memberId: ObjectId,
  ): Promise<Notices> {
    return await this.noticeService.getNotices(memberId);
  }
}
