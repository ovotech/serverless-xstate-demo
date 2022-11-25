import { APIGatewayProxyWebsocketHandlerV2 } from "aws-lambda";
import { DynamoDB } from "aws-sdk";

const ddb = new DynamoDB.DocumentClient();

export const connect = () => ({ statusCode: 200, body: "Connected." });

export const listen: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log("event", event);
  const connectionId = event.requestContext.connectionId;
  const machineId = JSON.parse(event.body ?? "{}")?.data?.machineId;

  if (!machineId) {
    console.log("No machineId provided");
    return {
      statusCode: 400,
      body: "Missing machineId",
    };
  }

  await ddb
    .put({
      TableName: process.env.DYNAMO_TABLE ?? "",
      Item: {
        connectionId,
        machineId,
      },
    })
    .promise();

  return {
    statusCode: 200,
  };
};

export const disconnect: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  await ddb
    .delete({
      TableName: process.env.DYNAMO_TABLE ?? "",
      Key: {
        connectionId: event.requestContext.connectionId,
      },
    })
    .promise();
  return {
    statusCode: 200,
  };
};
