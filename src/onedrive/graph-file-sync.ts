import 'isomorphic-fetch';

import { Client } from '@microsoft/microsoft-graph-client';

import {
  OneDriveDelegatedAuthProvider,
} from './graph-auth-provider.js';

const config = {
  driveId: process.env.GRAPH_DRIVE_ID ?? 'me',
  itemPath: process.env.GRAPH_ITEM_PATH!,
};

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

function itemApiPath(
  driveId: string,
  itemPath: string,
): string {
  const root =
    driveId === 'me'
      ? '/me/drive/root'
      : `/drives/${driveId}/root`;

  return `${root}:${itemPath}`;
}


async function downloadFile(
  graphClient: Client,
): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const basePath = itemApiPath(
    config.driveId,
    config.itemPath,
  );

  const item = await graphClient
    .api(basePath)
    .get();

  const stream = await graphClient
    .api(`${basePath}:/content`)
    .getStream();

  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk),
    );
  }

  return {
    buffer: Buffer.concat(chunks),
    fileName: item.name,
  };
}

async function testDownload() {
  const graphClient = getGraphClient();

  const {
    buffer,
    fileName,
  } = await downloadFile(graphClient);

  console.log('File name:', fileName);

  console.log(
    'File size:',
    buffer.length,
    'bytes',
  );
  
}

testDownload().catch((error) => {
  console.error('Download failed:', error);
  process.exit(1);
});