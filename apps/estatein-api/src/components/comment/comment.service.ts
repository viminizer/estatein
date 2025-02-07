import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId } from "mongoose";
import { Comment, Comments } from "../../libs/dto/comment/comment";
import { MemberService } from "../member/member.service";
import { PropertyService } from "../property/property.service";
import {
  CommentInput,
  CommentsInquiry,
} from "../../libs/dto/comment/comment.input";
import { BoardArticleService } from "../board-article/board-article.service";
import { CommentGroup, CommentStatus } from "../../libs/enums/comment.enum";
import { Direction, Message } from "../../libs/enums/common.enum";
import { lookupMember, shapeIntoMongoObjectId } from "../../libs/config";
import { CommentUpdate } from "../../libs/dto/comment/comment.update";
import { T } from "../../libs/types/common";
import { NotificationInput } from "../../libs/dto/notification/notification.input";
import {
  NotificationGroup,
  NotificationType,
} from "../../libs/enums/notification.enum";
import { NotificationService } from "../notification/notification.service";

@Injectable()
export class CommentService {
  constructor(
    @InjectModel("Comment") private readonly commentModel: Model<Comment>,
    private memberService: MemberService,
    private propertyService: PropertyService,
    private boardArticleService: BoardArticleService,
    private notificationService: NotificationService,
  ) { }

  public async createComment(
    memberId: ObjectId,
    input: CommentInput,
  ): Promise<Comment> {
    input.memberId = memberId;
    input.commentRefId = shapeIntoMongoObjectId(input.commentRefId);
    let result = null;
    try {
      result = await this.commentModel.create(input);
    } catch (err) {
      console.log("Comment Service Error: createComment", err);
      throw new InternalServerErrorException(Message.CREATE_FAILED);
    }

    const notifInput: NotificationInput = {
      notificationGroup: null,
      notificationType: NotificationType.COMMENT,
      notificationTitle: "",
      notificationDesc: "",
      authorId: memberId,
      receiverId: null,
    };

    let target: any;
    switch (input.commentGroup) {
      case CommentGroup.PROPERTY:
        target = await this.propertyService.propertyStatsEditor({
          _id: input.commentRefId,
          targetKey: "propertyComments",
          modifier: 1,
        });
        notifInput.notificationGroup = NotificationGroup.PROPERTY;
        notifInput.notificationTitle = "Property Comment!";
        notifInput.notificationDesc = "Someone commented on your property!";
        notifInput.receiverId = target.memberId;
        notifInput.propertyId = input.commentRefId;

        break;
      case CommentGroup.ARTICLE:
        target = await this.boardArticleService.boardArticleStatsEditor({
          _id: input.commentRefId,
          targetKey: "articleComments",
          modifier: 1,
        });
        notifInput.notificationGroup = NotificationGroup.ARTICLE;
        notifInput.notificationTitle = "Article Comment!";
        notifInput.notificationDesc = "Someone commented on your article!";
        notifInput.receiverId = target.memberId;
        notifInput.articleId = input.commentRefId;
        break;
      case CommentGroup.MEMBER:
        await this.memberService.memberStatsModifier({
          _id: input.commentRefId,
          targetKey: "memberComments",
          modifier: 1,
        });
        notifInput.notificationGroup = NotificationGroup.MEMBER;
        notifInput.notificationTitle = "Profile Comment!";
        notifInput.notificationDesc = "Someone commented on your profile!";
        notifInput.receiverId = input.commentRefId;
        break;
    }
    await this.notificationService.createNotification(notifInput);

    if (!result) throw new InternalServerErrorException(Message.CREATE_FAILED);
    return result;
  }

  public async updateComment(
    memberId: ObjectId,
    input: CommentUpdate,
  ): Promise<Comment> {
    const search: T = {
      _id: input._id,
      memberId: memberId,
      commentStatus: CommentStatus.ACTIVE,
    };
    const { commentStatus } = input;
    const result = await this.commentModel
      .findOneAndUpdate(search, input, { new: true })
      .exec();
    if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
    if (commentStatus === CommentStatus.DELETE) {
      switch (result.commentGroup) {
        case CommentGroup.PROPERTY:
          await this.propertyService.propertyStatsEditor({
            _id: result.commentRefId,
            targetKey: "propertyComments",
            modifier: -1,
          });
          break;
        case CommentGroup.ARTICLE:
          await this.boardArticleService.boardArticleStatsEditor({
            _id: result.commentRefId,
            targetKey: "articleComments",
            modifier: -1,
          });
          break;
        case CommentGroup.MEMBER:
          await this.memberService.memberStatsModifier({
            _id: result.commentRefId,
            targetKey: "memberComments",
            modifier: -1,
          });
          break;
      }
    }
    return result;
  }

  public async getComments(
    memberId: ObjectId,
    input: CommentsInquiry,
  ): Promise<Comments> {
    const { commentRefId } = input.search;
    const match: T = {
      commentRefId: commentRefId,
      commentStatus: CommentStatus.ACTIVE,
    };
    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };
    const result: Comments[] = await this.commentModel
      .aggregate([
        { $match: match },
        { $sort: sort },
        {
          $facet: {
            list: [
              { $skip: (input.page - 1) * input.limit },
              { $limit: input.limit },
              lookupMember,
              { $unwind: "$memberData" },
            ],
            metaCounter: [{ $count: "total" }],
          },
        },
      ])
      .exec();
    if (!result.length)
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    return result[0];
  }

  public async removeCommentByAdmin(commentId: ObjectId): Promise<Comment> {
    const result = await this.commentModel.findByIdAndDelete(commentId).exec();
    if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
    return result;
  }
}
