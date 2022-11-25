import { SQS } from "aws-sdk";

export async function handler() {
  await sendMessage("1", "COUNT");

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
        MessageBody: JSON.stringify({ body }),
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
