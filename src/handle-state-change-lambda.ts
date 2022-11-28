import { DynamoDBStreamEvent } from "aws-lambda";
import { DynamoDB } from "aws-sdk";

const ddb = new DynamoDB.DocumentClient();

export async function handler(event: DynamoDBStreamEvent) {
  console.log("event", event);

  const changes = event.Records.map((record) => ({
    machineId: record.dynamodb!.NewImage!.machineId.S!,
    state: JSON.parse(record.dynamodb!.NewImage!.state.S!),
  }));

  console.log(changes);

  return {
    statusCode: 200,
  };
}
