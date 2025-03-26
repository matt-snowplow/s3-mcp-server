import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { extractTextFromS3Object } from "../src/server.ts";
dotenv.config();

async function testPptxConversion() {
  try {
    const s3Client = new S3Client({
      region: process.env.AWS_REGION || "ap-northeast-2",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });

    const command = new GetObjectCommand({
      Bucket: "coursework-contents",
      Key: "internet-protocol/first.pptx",
    });

    const response = await s3Client.send(command);

    // which means pptx or ppt
    if (response.ContentType?.includes("presentation")) {
      console.log("pptx or ppt");
    }

    const extractedText = await extractTextFromS3Object(
      response.Body as ReadableStream
    );

    const resultJSON = {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
      metadata: response.Metadata,
      text: extractedText || "No content",
    };

    console.log("Extracted Text from PPTX:");
    console.log(resultJSON.text);

    return extractedText;
  } catch (error) {
    console.error("Error during PPTX conversion test:", error);
    throw error;
  }
}

testPptxConversion().catch(console.error);
