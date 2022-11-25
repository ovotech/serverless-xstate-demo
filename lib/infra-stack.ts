import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as dynamo from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import { CfnOutput } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";

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
  }
}
