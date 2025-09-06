import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotificationTypeDto {
  @Field()
  key: string;

  @Field()
  title: string;

  @Field()
  description: string;

  @Field()
  category: string;

  @Field({ nullable: true })
  schedule?: string;
}

@ObjectType()
export class NotificationTypesResponse {
  @Field(() => [NotificationTypeDto])
  types: NotificationTypeDto[];
}