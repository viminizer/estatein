import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { Model, ObjectId } from "mongoose";
import {
  BoardArticle,
  BoardArticles,
} from "../../libs/dto/board-article/board-article";
import { InjectModel } from "@nestjs/mongoose";
import {
  AllBoardArticlesInquiry,
  BoardArticleInput,
  BoardArticlesInquiry,
} from "../../libs/dto/board-article/board-article.input";
import { Direction, Message } from "../../libs/enums/common.enum";
import { MemberService } from "../member/member.service";
import { ViewService } from "../view/view.service";
import { StatsModifier, T } from "../../libs/types/common";
import { BoardArticleStatus } from "../../libs/enums/board-article.enum";
import { ViewInput } from "../../libs/dto/view/view.input";
import { ViewGroup } from "../../libs/enums/view.enum";
import { BoardArticleUpdate } from "../../libs/dto/board-article/board-article.update";
import {
  lookupAuthMemberLiked,
  lookupMember,
  shapeIntoMongoObjectId,
} from "../../libs/config";
import { LikeInput } from "../../libs/dto/like/like.input";
import { LikeGroup } from "../../libs/enums/like.enum";
import { LikeService } from "../like/like.service";
import { NotificationService } from "../notification/notification.service";
import { NotificationInput } from "../../libs/dto/notification/notification.input";
import {
  NotificationGroup,
  NotificationType,
} from "../../libs/enums/notification.enum";

@Injectable()
export class BoardArticleService {
  constructor(
    @InjectModel("BoardArticle")
    private readonly boardArticleModel: Model<BoardArticle>,
    private memberService: MemberService,
    private viewService: ViewService,
    private likeService: LikeService,
    private notificationService: NotificationService,
  ) { }

  public async createBoardArticle(
    memberId: ObjectId,
    input: BoardArticleInput,
  ): Promise<BoardArticle> {
    input.memberId = memberId;
    try {
      const result = await this.boardArticleModel.create(input);
      await this.memberService.memberStatsModifier({
        _id: memberId,
        targetKey: "memberArticles",
        modifier: 1,
      });
      return result;
    } catch (err) {
      console.log("Board Article Service: createBoardArticle", err.message);
      throw new InternalServerErrorException(Message.CREATE_FAILED);
    }
  }

  public async getBoardArticle(
    memberId: ObjectId,
    articleId: ObjectId,
  ): Promise<BoardArticle> {
    const search: T = {
      _id: articleId,
      articleStatus: BoardArticleStatus.ACTIVE,
    };
    const targetArticle = await this.boardArticleModel
      .findOne(search)
      .lean<BoardArticle>()
      .exec();
    if (!targetArticle)
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    if (memberId) {
      const viewInput: ViewInput = {
        viewRefId: articleId,
        memberId: memberId,
        viewGroup: ViewGroup.ARTICLE,
      };
      const newView = await this.viewService.recordView(viewInput);
      if (newView) {
        await this.boardArticleStatsEditor({
          _id: articleId,
          targetKey: "articleViews",
          modifier: 1,
        });
        targetArticle.articleViews++;
      }
      const likeInput = {
        memberId,
        likeRefId: articleId,
        likeGroup: LikeGroup.ARTICLE,
      };
      targetArticle.meLiked =
        await this.likeService.checkLikeExistence(likeInput);
    }
    targetArticle.memberData = await this.memberService.getMember(
      null,
      targetArticle.memberId,
    );
    return targetArticle;
  }

  public async updateBoardArticle(
    memberId: ObjectId,
    input: BoardArticleUpdate,
  ): Promise<BoardArticle> {
    const { articleStatus } = input;
    const search: T = {
      _id: input._id,
      memberId: memberId,
      articleStatus: BoardArticleStatus.ACTIVE,
    };
    const result = await this.boardArticleModel
      .findOneAndUpdate(search, input, { new: true })
      .exec();
    if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
    if (articleStatus === BoardArticleStatus.DELETE) {
      await this.memberService.memberStatsModifier({
        _id: memberId,
        targetKey: "memberArticles",
        modifier: -1,
      });
    }
    return result;
  }

  public async getBoardArticles(
    memberId: ObjectId,
    input: BoardArticlesInquiry,
  ): Promise<BoardArticles> {
    const { articleCategory, text } = input?.search;
    const match: T = { articleStatus: BoardArticleStatus.ACTIVE };
    if (articleCategory) match.articleCategory = articleCategory;
    if (input?.search?.memberId)
      match.memberId = shapeIntoMongoObjectId(input.search?.memberId);
    if (text) match.articleTitle = { $regex: new RegExp(text, "i") };
    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };
    console.log("MATCH", match);
    const result = await this.boardArticleModel.aggregate([
      { $match: match },
      { $sort: sort },
      {
        $facet: {
          list: [
            { $skip: (input.page - 1) * input.limit },
            { $limit: input.limit },
            lookupAuthMemberLiked(memberId),
            lookupMember,
            { $unwind: "$memberData" },
          ],
          metaCounter: [{ $count: "total" }],
        },
      },
    ]);
    if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    return result[0];
  }

  public async getAllBoardArticlesByAdmin(
    memberId: ObjectId,
    input: AllBoardArticlesInquiry,
  ): Promise<BoardArticles> {
    const { articleCategory, articleStatus } = input?.search;
    const match: T = {};
    if (articleCategory) match.articleCategory = articleCategory;
    if (articleStatus) match.articleStatus = articleStatus;
    const sort: T = {
      [input?.sort ?? "createdAt"]: input?.direction ?? Direction.DESC,
    };
    const result = await this.boardArticleModel.aggregate([
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
    ]);
    if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    return result[0];
  }

  public async updateBoardArticleByAdmin(
    input: BoardArticleUpdate,
  ): Promise<BoardArticle> {
    const { articleStatus } = input;
    const search: T = {
      _id: input._id,
      articleStatus: BoardArticleStatus.ACTIVE,
    };
    const result = await this.boardArticleModel
      .findOneAndUpdate(search, input, { new: true })
      .exec();
    if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
    if (articleStatus === BoardArticleStatus.DELETE) {
      await this.memberService.memberStatsModifier({
        _id: result.memberId,
        targetKey: "memberArticles",
        modifier: -1,
      });
    }
    return result;
  }

  public async removeBoardArticleByAdmin(
    articleId: ObjectId,
  ): Promise<BoardArticle> {
    const result = await this.boardArticleModel
      .findOneAndDelete({
        _id: articleId,
        articleStatus: BoardArticleStatus.DELETE,
      })
      .exec();
    if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
    return result;
  }

  public async likeTargetBoardArticle(
    memberId: ObjectId,
    likeRefId: ObjectId,
  ): Promise<BoardArticle> {
    const target: BoardArticle = await this.boardArticleModel
      .findOne({ _id: likeRefId, articleStatus: BoardArticleStatus.ACTIVE })
      .exec();
    if (!target) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
    const input: LikeInput = {
      memberId: memberId,
      likeRefId: likeRefId,
      likeGroup: LikeGroup.ARTICLE,
    };
    const modifier: number = await this.likeService.toggleLike(input);

    if (modifier === 1) {
      const notifInput: NotificationInput = {
        notificationGroup: NotificationGroup.ARTICLE,
        notificationType: NotificationType.LIKE,
        notificationTitle: "Article Liked!",
        notificationDesc: "Someone liked your board article!",
        authorId: memberId,
        receiverId: target.memberId,
        propertyId: likeRefId,
      };
      await this.notificationService.createNotification(notifInput);
    }
    const result = await this.boardArticleStatsEditor({
      _id: likeRefId,
      targetKey: "articleLikes",
      modifier: modifier,
    });
    if (!result)
      throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
    return result;
  }

  public async boardArticleStatsEditor(
    input: StatsModifier,
  ): Promise<BoardArticle> {
    console.log("Board Article Stats Modifier executed");
    const { _id, targetKey, modifier } = input;
    return await this.boardArticleModel.findOneAndUpdate(
      { _id: _id },
      { $inc: { [targetKey]: modifier } },
      { new: true },
    );
  }
}
