import { DynamoDBStreamEvent } from "aws-lambda";

export async function handler(event: DynamoDBStreamEvent) {
  console.log("event", event);

  return {
    statusCode: 200,
  };
}
