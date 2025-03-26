import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { PdfReader } from "pdfreader";
import { extractTextFromS3Object } from "./convert.js";
import type { Readable } from "node:stream";

dotenv.config();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error(
    "Error: AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables."
  );
  process.exit(1);
}

function extractTextFromPdfBuffer(pdfBuffer: Buffer) {
  return new Promise((resolve, reject) => {
    const textItems: string[] = [];

    new PdfReader().parseBuffer(pdfBuffer, (err, item) => {
      if (err) {
        reject(err);
      } else if (!item) {
        resolve(textItems.join(" "));
      } else if (item.text) {
        textItems.push(item.text);
      }
    });
  });
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-northeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "";

const mcpServer = new McpServer({
  name: "S3 MCP Server",
  version: "1.0.0",
  description: "MCP Server for accessing S3 bucket",
});

mcpServer.tool("get_object", { key: z.string() }, async ({ key }) => {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key as string,
  });

  const response = await s3Client.send(command);

  let parsedContent: unknown;

  if (!response.Body) {
    throw new Error("No body found");
  }

  if (response.ContentType?.includes("pdf")) {
    parsedContent = await extractTextFromPdfBuffer(
      Buffer.from(await response.Body.transformToByteArray())
    );
  } else if (
    response.ContentType?.includes("pptx") ||
    response.ContentType?.includes("ppt")
  ) {
    const chunks = [];
    for await (const chunk of response.Body as Readable) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    parsedContent = await extractTextFromS3Object(
      new ReadableStream({
        start(controller) {
          controller.enqueue(buffer);
          controller.close();
        },
      })
    );
  } else {
    parsedContent = await response.Body?.transformToString();
  }

  const resultJSON = {
    contentLength: response.ContentLength,
    contentType: response.ContentType,
    lastModified: response.LastModified,
    metadata: response.Metadata,
    text: parsedContent || "No content",
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(resultJSON),
      },
    ],
  };
});

mcpServer.tool("list_buckets", { prefix: z.string() }, async ({ prefix }) => {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix as string,
  });

  const response = await s3Client.send(command);
  return {
    content:
      response.Contents?.map((item) => ({
        type: "text",
        text: `${item.Key}`,
      })) || [],
  };
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
