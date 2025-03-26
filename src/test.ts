import { extractTextFromS3Object } from "./convert.ts";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

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

    const extractedText = await extractTextFromS3Object(
      response.Body as ReadableStream
    );

    console.log("Extracted Text from PPTX:");
    console.log(extractedText);

    return extractedText;
  } catch (error) {
    console.error("Error during PPTX conversion test:", error);
    throw error;
  }
}

testPptxConversion().catch(console.error);
