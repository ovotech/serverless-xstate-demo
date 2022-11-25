import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamo from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { CfnOutput } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as apigwv2 from "@aws-cdk/aws-apigatewayv2-alpha";
import { WebSocketLambdaIntegration } from "@aws-cdk/aws-apigatewayv2-integrations-alpha";

export class InfraStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const queue = new sqs.Queue(this, "XStateEventQueue", {
      fifo: true,
      deadLetterQueue: {
        queue: new sqs.Queue(this, "XStateEventQueueDeadLetterQueue", {
          fifo: true,
        }),
        maxReceiveCount: 3,
      },
    });

    const sendMessageFn = new nodejs.NodejsFunction(this, "SendMessage", {
      entry: "src/send-message-lambda.ts",
      handler: "handler",
      environment: {
        QUEUE_URL: queue.queueUrl,
      },
    });

    sendMessageFn.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["sqs:SendMessage"],
        resources: [queue.queueArn],
      })
    );

    const sendMessageFnUrl = sendMessageFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
    });
    new CfnOutput(this, "SendMessageFnUrl", {
      value: sendMessageFnUrl.url,
    });

    const stateStorage = new dynamo.Table(this, "XStateStorage", {
      partitionKey: {
        name: "machineId",
        type: dynamo.AttributeType.STRING,
      },
      stream: dynamo.StreamViewType.NEW_IMAGE,
    });

    const machineFn = new nodejs.NodejsFunction(this, "XStateApp", {
      entry: "src/machine-lambda.ts",
      handler: "handler",
      bundling: {},
      environment: {
        DYNAMO_TABLE: stateStorage.tableName,
      },
    });

    stateStorage.grantReadWriteData(machineFn);

    machineFn.addEventSource(
      new eventSources.SqsEventSource(queue, {
        batchSize: 1,
      })
    );

    const connectionStorage = new dynamo.Table(
      this,
      "XStateConnectionStorage",
      {
        partitionKey: {
          name: "connectionId",
          type: dynamo.AttributeType.STRING,
        },
        sortKey: {
          name: "machineId",
          type: dynamo.AttributeType.STRING,
        },
      }
    );

    const websocketConnectFn = new nodejs.NodejsFunction(
      this,
      "XStateConnectWS",
      {
        entry: "src/websocket-handlers.ts",
        handler: "connect",
        bundling: {},
        environment: {
          DYNAMO_TABLE: connectionStorage.tableName,
        },
      }
    );

    const websocketListenFn = new nodejs.NodejsFunction(
      this,
      "XStateListenWS",
      {
        entry: "src/websocket-handlers.ts",
        handler: "listen",
        bundling: {},
        environment: {
          DYNAMO_TABLE: connectionStorage.tableName,
        },
      }
    );

    const websocketDisconnectFn = new nodejs.NodejsFunction(
      this,
      "XStateDisconnectWS",
      {
        entry: "src/websocket-handlers.ts",
        handler: "disconnect",
        bundling: {},
        environment: {
          DYNAMO_TABLE: connectionStorage.tableName,
        },
      }
    );

    const webSocketApi = new apigwv2.WebSocketApi(this, "APIWebsocket", {
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "ConnectIntegration",
          websocketConnectFn
        ),
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          "DisconnectIntegration",
          websocketDisconnectFn
        ),
      },
    });

    webSocketApi.addRoute("listen", {
      integration: new WebSocketLambdaIntegration(
        "ListenIntegration",
        websocketListenFn
      ),
    });

    new CfnOutput(this, "WebsocketAPIUrl", {
      value: webSocketApi.apiEndpoint,
    });

    new apigwv2.WebSocketStage(this, "WebsocketStage", {
      webSocketApi,
      stageName: "prod",
      autoDeploy: true,
    });

    const handleStateChangeHandler = new nodejs.NodejsFunction(
      this,
      "XStateHandleStateChange",
      {
        entry: "src/handle-state-change-lambda.ts",
        handler: "handler",
        bundling: {},
        environment: {
          DYNAMO_TABLE: connectionStorage.tableName,
        },
      }
    );

    handleStateChangeHandler.addEventSource(
      new eventSources.DynamoEventSource(stateStorage, {
        startingPosition: lambda.StartingPosition.LATEST,
      })
    );

    [
      handleStateChangeHandler,
      websocketListenFn,
      websocketDisconnectFn,
    ].forEach((fn) => connectionStorage.grantReadWriteData(fn));
  }
}
