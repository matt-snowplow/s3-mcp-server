import { S3Client, ListObjectsV2Command, GetObjectCommand, } from "@aws-sdk/client-s3";
import { McpServer, } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import dotenv from "dotenv";
import { PdfReader } from "pdfreader";
dotenv.config();
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.error("Error: AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.");
    process.exit(1);
}
function extractTextFromPdfBuffer(pdfBuffer) {
    return new Promise((resolve, reject) => {
        const textItems = [];
        new PdfReader().parseBuffer(pdfBuffer, (err, item) => {
            if (err) {
                reject(err);
            }
            else if (!item) {
                // 파싱 완료, 모든 텍스트 결합하여 반환
                resolve(textItems.join(" "));
            }
            else if (item.text) {
                // 텍스트 항목 추가
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
const BUCKET_NAME = process.env.S3_BUCKET_NAME || "image-uploading-test-bucket";
const mcpServer = new McpServer({
    name: "S3 MCP Server",
    version: "1.0.0",
    description: "MCP Server for accessing S3 bucket",
});
mcpServer.tool("get_object", { key: z.string() }, async ({ key }) => {
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    });
    const response = await s3Client.send(command);
    let parsedContent;
    if (response.ContentType?.includes("pdf") && response.Body) {
        parsedContent = await extractTextFromPdfBuffer(Buffer.from(await response.Body.transformToByteArray()));
    }
    else {
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
        Prefix: prefix,
    });
    const response = await s3Client.send(command);
    return {
        content: response.Contents?.map((item) => ({
            type: "text",
            text: `${item.Key}`,
        })) || [],
    };
});
const transport = new StdioServerTransport();
await mcpServer.connect(transport);
