/**
 * onedrive-device-code-auth.ts
 *
 * Run this ONCE, manually, from your own machine or a terminal with
 * browser access. It walks you through signing in with your personal
 * Microsoft account and prints a refresh token you store as
 * ONEDRIVE_REFRESH_TOKEN for graph-file-sync.ts to use going forward.
 *
 * npm i @azure/msal-node
 * npx ts-node onedrive-device-code-auth.ts
 */

import { PublicClientApplication } from '@azure/msal-node';

const CLIENT_ID = process.env.AZURE_CLIENT_ID!; // from your app registration

async function main() {
  const pca = new PublicClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: 'https://login.microsoftonline.com/consumers',
    },
  });

  const result = await pca.acquireTokenByDeviceCode({
    scopes: ['Files.Read', 'offline_access'],
    deviceCodeCallback: (response) => {
      // Log the raw response too, in case `.message` is ever undefined —
      // verificationUri and userCode are what you actually need either way.
      console.log('Device code response:', JSON.stringify(response, null, 2));
      console.log(
        response.message ??
          `To sign in, open ${response.verificationUri} and enter the code ${response.userCode}`,
      );
    },
  });

  if (!result) {
    throw new Error('Device code flow did not return a token result.');
  }

  console.log('\nSign-in successful.');
  console.log(
    'Access token (short-lived, ignore this):',
    result.accessToken.slice(0, 20) + '...',
  );

  // msal-node doesn't expose the refresh token directly on the result —
  // it's held in the token cache. Extract it from there:
  const cache = pca.getTokenCache().serialize();
  const parsed = JSON.parse(cache);
  const refreshTokens = parsed.RefreshToken ?? {};
  const firstKey = Object.keys(refreshTokens)[0];

  if (!firstKey) {
    throw new Error(
      'No refresh token found in cache — check the requested scopes include offline_access.',
    );
  }

  console.log(
    '\nStore this as ONEDRIVE_REFRESH_TOKEN (treat it like a secret):\n',
  );
  console.log(refreshTokens[firstKey].secret);
}

main().catch((err) => {
  console.error('Auth failed. Full error detail below:');
  console.error(JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
  process.exit(1);
});
