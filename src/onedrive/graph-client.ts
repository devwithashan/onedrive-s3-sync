import 'isomorphic-fetch';

import { Client } from '@microsoft/microsoft-graph-client';
import { GraphAuthProvider } from './graph-auth-provider.js';



export function getGraphClient(
  authProvider: GraphAuthProvider,
): Client {
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