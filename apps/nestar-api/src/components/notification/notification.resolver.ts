import { Args, Query, Resolver } from "@nestjs/graphql";
import { NotificationService } from "./notification.service";
import { Notifications } from "../../libs/dto/notification/notification";
import { AuthGuard } from "../auth/guards/auth.guard";
import { UseGuards } from "@nestjs/common";
import { ObjectId } from "mongoose";
import { AuthMember } from "../auth/decorators/authMember.decorator";

@Resolver()
export class NotificationResolver {
  constructor(private readonly notificationService: NotificationService) { }

  @UseGuards(AuthGuard)
  @Query(() => Notifications)
  public async getNotifications(
    @AuthMember("_id") memberId: ObjectId,
  ): Promise<Notifications> {
    console.log("Query: getNotifications");
    return await this.notificationService.getNotifications(memberId);
  }
}
