import 'isomorphic-fetch';

import { Client } from '@microsoft/microsoft-graph-client';

import { OneDriveDelegatedAuthProvider } from './graph-auth-provider.js';

const config = {
  driveId: process.env.GRAPH_DRIVE_ID ?? 'me',
  itemPath: process.env.GRAPH_ITEM_PATH!,
  notificationUrl: process.env.WEBHOOK_NOTIFICATION_URL!,
  clientState: process.env.WEBHOOK_CLIENT_STATE!,
};

function getGraphClient(): Client {
  const authProvider = new OneDriveDelegatedAuthProvider(
    process.env.AZURE_CLIENT_ID!,
    process.env.ONEDRIVE_REFRESH_TOKEN!,
  );

  return Client.init({
    authProvider: async (done) => {
      try {
        done(null, await authProvider.getAccessToken());
      } catch (error) {
        done(error as Error, null);
      }
    },
  });
}

async function resolveResource(graphClient: Client): Promise<string> {
  // Personal (consumer) OneDrive only supports subscribing at the whole-drive
  // level — item-scoped subscriptions ("/me/drive/items/{id}") return
  // "resource ... is not supported" for MSA accounts. The webhook handler
  // re-syncs the one configured file regardless of which item changed, so a
  // drive-wide subscription is fine for our purposes.
  if (config.driveId === 'me') {
    return '/me/drive/root';
  }

  const item = await graphClient
    .api(`/drives/${config.driveId}/root:${config.itemPath}`)
    .get();

  return `/drives/${config.driveId}/items/${item.id}`;
}

function nextExpiration(): string {
  return new Date(Date.now() + 29 * 24 * 60 * 60 * 1000).toISOString();
}

export async function createSubscription() {
  const graphClient = getGraphClient();
  const resource = await resolveResource(graphClient);

  const subscription = await graphClient.api('/subscriptions').post({
    changeType: 'updated',
    notificationUrl: config.notificationUrl,
    resource,
    expirationDateTime: nextExpiration(),
    clientState: config.clientState,
  });

  console.log(
    'Subscription created:',
    subscription.id,
    'expires',
    subscription.expirationDateTime,
  );

  return subscription;
}

export async function renewSubscription(subscriptionId: string) {
  const graphClient = getGraphClient();

  const updated = await graphClient
    .api(`/subscriptions/${subscriptionId}`)
    .patch({ expirationDateTime: nextExpiration() });

  console.log(
    'Subscription renewed:',
    updated.id,
    'new expiry',
    updated.expirationDateTime,
  );

  return updated;
}

const isMainModule =
  process.argv[1] !== undefined &&
  import.meta.url === new URL(process.argv[1], 'file://').href;

if (isMainModule) {
  const [, , command, subscriptionId] = process.argv;

  if (command === 'create') {
    createSubscription().catch((error) => {
      console.error('Failed to create subscription:', error);
      process.exit(1);
    });
  } else if (command === 'renew' && subscriptionId) {
    renewSubscription(subscriptionId).catch((error) => {
      console.error('Failed to renew subscription:', error);
      process.exit(1);
    });
  } else {
    console.log(
      'Usage: npm run dev:script -- src/onedrive/graph-subscription-manager.ts create|renew <id>',
    );
  }
}
