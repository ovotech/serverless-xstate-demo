import type { APIGatewayEvent } from "aws-lambda";
import { SQS } from "aws-sdk";

export async function handler(event: APIGatewayEvent) {
  const payload = JSON.parse(event.body!);
  console.log("Received payload", payload);

  await sendMessage(payload.machineId, payload.event);

  return {
    statusCode: 202,
    body: "OK",
  };
}

const sqs = new SQS();
const sendMessage = (groupdId: string, body: any) =>
  new Promise((res, rej) => {
    sqs.sendMessage(
      {
        QueueUrl: process.env.QUEUE_URL!,
        MessageGroupId: groupdId,
        MessageDeduplicationId: Math.random().toString(),
        MessageBody: JSON.stringify(body),
      },
      (err, data) => {
        if (err) {
          rej(err);
        } else {
          res(data);
        }
      }
    );
  });
