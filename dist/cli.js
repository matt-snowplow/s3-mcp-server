#!/usr/bin/env node
import { program } from "commander";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
program
    .version(packageJson.version)
    .option("-p, --port <number>", "Port number", "3000")
    .option("-r, --region <string>", "AWS region", "ap-northeast-2")
    .option("-b, --bucket <string>", "S3 bucket name", "image-uploading-test-bucket")
    .option("-t, --content-type <string>", "Input file content type", "application/octet-stream")
    .parse(process.argv);
const options = program.opts();
// Set environment variables based on CLI options
process.env.PORT = options.port;
process.env.AWS_REGION = options.region;
process.env.S3_BUCKET_NAME = options.bucket;
process.env.CONTENT_TYPE = options.contentType;
// Import and start the server using absolute path
import(join(__dirname, "server.js"));
