# S3 MCP Server

A Model Context Protocol (MCP) server for accessing Amazon S3 buckets. This server provides seamless integration with S3 storage through MCP, allowing efficient handling of large files including PDFs through streaming capabilities.

## Features

- S3 bucket object listing with prefix filtering
- Efficient large file handling through streaming
- Secure AWS credentials management
- TypeScript support
- CLI interface with customizable options

## Installation

```bash
npx -y @geunoh/s3-mcp-server
```

## Usage

### Command Line Options

```bash
npx -y @geunoh/s3-mcp-server [options]
```

Options:

- `--port, -p`: Server port (default: 3000)
- `--region, -r`: AWS region (default: ap-northeast-2)
- `--bucket, -b`: S3 bucket name (default: my-dancing-bucket)

### Environment Variables

Required:

```bash
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
```

Optional:

```bash
export AWS_REGION="ap-northeast-2"
export S3_BUCKET_NAME="my-bucket-name"
```

### MCP Integration

Add to your mcp.json:

```json
{
  "mcpServers": {
    "s3-mcp-server": {
      "command": "npx",
      "args": ["-y", "@geunoh/s3-mcp-server"],
      "env": {
        "AWS_ACCESS_KEY_ID": "YOUR_AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY": "YOUR_AWS_SECRET_ACCESS_KEY",

        // optional
        "AWS_REGION": "ap-northeast-2",
        "S3_BUCKET_NAME": "my-bucket-name",
      }
    }
  }
}
```

## Available MCP Functions

### listObjects

Lists objects in the S3 bucket.

Parameters:

- `prefix` (optional): Filter objects by prefix

### getObject

Retrieves an object from the S3 bucket. Optimized for large files through streaming.

Parameters:

- `key`: The key of the object to retrieve

Returns:

- `stream`: ReadableStream of the object content
- `contentType`: MIME type of the object
- `contentLength`: Size of the object in bytes
- `lastModified`: Last modification timestamp
- `text`: Text buffer of raw pdf ByteArray

## AWS IAM Permissions

Minimum required permissions (see s3-policy.json):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::my-bucket-name"
        }
    ]
}
```

## Development

1. Clone the repository:

```bash
git clone https://github.com/Geun-Oh/s3-mcp-server.git
cd s3-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Run locally:

```bash
node dist/cli.js
```

## Project Structure

```
.
├── src/              # TypeScript source files
├── dist/            # Compiled JavaScript files and runtime dependencies
├── tsconfig.json    # TypeScript configuration
└── package.json     # Project configuration and dependencies
```

## Deployment

1. Create a new version tag:

```bash
npm version patch
```

2. Push to npm registry:

```bash
npm publish --access public
```

The GitHub Actions workflow will automatically publish the package when a new version tag is pushed.

## License

MIT

## Contributing

Issues and pull requests are welcome. Please ensure that your changes maintain the existing code style and include appropriate tests.
