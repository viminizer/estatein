import { Injectable, InternalServerErrorException } from "@nestjs/common";
import {
  Notification,
  Notifications,
} from "../../libs/dto/notification/notification";
import { T } from "../../libs/types/common";
import { Model, ObjectId } from "mongoose";
import { InjectModel } from "@nestjs/mongoose";
import { Message } from "../../libs/enums/common.enum";
import { NotificationInput } from "../../libs/dto/notification/notification.input";
import { NotificationStatus } from "../../libs/enums/notification.enum";

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel("Notification")
    private readonly notificatinoModel: Model<Notification>,
  ) { }

  public async getNotifications(memberId: ObjectId): Promise<Notifications> {
    const match: T = {
      receiverId: memberId,
      notificationStatus: NotificationStatus.WAIT,
    };
    const sort: T = { createdAt: -1 };
    const result: Notifications[] = await this.notificatinoModel
      .aggregate([
        { $match: match },
        { $sort: sort },
        {
          $facet: {
            list: [{ $skip: 0 }, { $limit: 100 }],
            metaCounter: [{ $count: "total" }],
          },
        },
      ])
      .exec();
    if (!result.length)
      throw new InternalServerErrorException(Message.NO_DATA_FOUND);

    return result[0];
  }

  public async createNotification(input: NotificationInput): Promise<void> {
    try {
      await this.notificatinoModel.create(input);
    } catch (err: any) {
      console.log("Notification Service Error: createNotification", err);
      throw new InternalServerErrorException(Message.CREATE_FAILED);
    }
  }

  public async updateNotification(input: ObjectId): Promise<void> { }
}
