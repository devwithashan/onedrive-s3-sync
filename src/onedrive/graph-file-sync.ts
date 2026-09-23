import 'isomorphic-fetch';

import { Client } from '@microsoft/microsoft-graph-client';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { OneDriveDelegatedAuthProvider } from './graph-auth-provider.js';

function getConfig() {
  return {
    driveId: process.env.GRAPH_DRIVE_ID ?? 'me',
    itemPath: process.env.GRAPH_ITEM_PATH!,
    s3: {
      bucket: process.env.S3_BUCKET!,
      region: process.env.AWS_REGION ?? 'us-east-1',
      keyPrefix: process.env.S3_KEY_PREFIX ?? 'graph-sync/',
    },
  };
}

function getGraphClient(): Client {
  const authProvider = new OneDriveDelegatedAuthProvider(
    process.env.AZURE_CLIENT_ID!,
    process.env.ONEDRIVE_REFRESH_TOKEN!,
  );

  return Client.init({
    authProvider: async (done) => {
      try {
        const token = await authProvider.getAccessToken();

        done(null, token);
      } catch (error) {
        done(error as Error, null);
      }
    },
  });
}

function itemApiPath(driveId: string, itemPath: string): string {
  const root = driveId === 'me' ? '/me/drive/root' : `/drives/${driveId}/root`;

  return `${root}:${itemPath}`;
}

async function downloadFile(
  graphClient: Client,
  driveId: string,
  itemPath: string,
): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const basePath = itemApiPath(driveId, itemPath);

  const item = await graphClient.api(basePath).get();

  const stream = await graphClient.api(`${basePath}:/content`).getStream();

  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return {
    buffer: Buffer.concat(chunks),
    fileName: item.name,
  };
}

async function uploadToS3(
  buffer: Buffer,
  fileName: string,
  s3Config: { bucket: string; region: string; keyPrefix: string },
): Promise<string> {
  const s3 = new S3Client({ region: s3Config.region });
  const key = `${s3Config.keyPrefix}${fileName}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      Body: buffer,
    }),
  );

  return key;
}

export async function syncFileToS3(): Promise<string> {
  const config = getConfig();
  const graphClient = getGraphClient();
  const { buffer, fileName } = await downloadFile(
    graphClient,
    config.driveId,
    config.itemPath,
  );
  const key = await uploadToS3(buffer, fileName, config.s3);

  console.log(`Synced ${fileName} to s3://${config.s3.bucket}/${key}`);

  return key;
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href;

if (isMainModule) {
  syncFileToS3().catch((error) => {
    console.error('Sync failed:', error);
    process.exit(1);
  });
}
