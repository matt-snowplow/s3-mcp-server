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
import AdmZip from "adm-zip";
import xml2js from "xml2js";
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

export async function extractTextFromPptxBuffer(pptxFile: Buffer) {
  try {
    const zip = new AdmZip(pptxFile);

    const slideEntries = zip.getEntries().filter((entry) => {
      return entry.entryName.match(/ppt\/slides\/slide[0-9]+\.xml/);
    });

    slideEntries.sort((a, b) => {
      const numA = Number.parseInt(
        a.entryName.match(/slide([0-9]+)\.xml/)?.[1] ?? "0"
      );
      const numB = Number.parseInt(
        b.entryName.match(/slide([0-9]+)\.xml/)?.[1] ?? "0"
      );
      return numA - numB;
    });

    const parser = new xml2js.Parser();
    let allText = "";

    for (const entry of slideEntries) {
      const slideXml = zip.readAsText(entry.entryName);
      const result = await parser.parseStringPromise(slideXml);

      const slideNumber =
        entry.entryName.match(/slide([0-9]+)\.xml/)?.[1] ?? -1;
      allText += `\n===== 슬라이드 ${slideNumber} =====\n`;

      const slideText = extractTextFromSlide(result);
      allText += slideText;
    }

    return allText;
  } catch (error) {
    console.error("PPTX 텍스트 추출 중 오류 발생:", error);
    throw error;
  }
}

function extractTextFromSlide(slideObj: any) {
  let text = "";

  try {
    const spTree = slideObj?.["p:sld"]?.["p:cSld"]?.[0]?.["p:spTree"]?.[0];

    if (!spTree) return text;

    const shapes = spTree["p:sp"] || [];
    for (const shape of shapes) {
      const txBody = shape["p:txBody"]?.[0];
      if (!txBody) continue;

      const paragraphs = txBody["a:p"] || [];
      for (const paragraph of paragraphs) {
        const runs = paragraph["a:r"] || [];
        let paragraphText = "";

        for (const run of runs) {
          const textElement = run["a:t"];
          if (textElement && textElement.length > 0) {
            paragraphText += textElement[0];
          }
        }

        if (paragraphText) {
          text += `${paragraphText}\n`;
        }
      }
    }

    return text;
  } catch (error) {
    console.error("슬라이드 텍스트 추출 중 오류 발생:", error);
    return text;
  }
}

export async function extractTextFromS3Object(s3Body: ReadableStream) {
  try {
    const chunks = [];
    for await (const chunk of s3Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const text = await extractTextFromPptxBuffer(buffer);
    return text;
  } catch (error) {
    console.error("S3 객체에서 텍스트 추출 중 오류 발생:", error);
    throw error;
  }
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
  } else if (response.ContentType?.includes("presentation")) {
    parsedContent = await extractTextFromS3Object(
      response.Body as ReadableStream
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
