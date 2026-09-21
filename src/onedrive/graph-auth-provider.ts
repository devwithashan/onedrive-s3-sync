import { PublicClientApplication } from '@azure/msal-node';

export interface GraphAuthProvider {
  getAccessToken(): Promise<string>;
}

export class OneDriveDelegatedAuthProvider
  implements GraphAuthProvider
{
  private msalApp: PublicClientApplication;

  constructor(
    private readonly clientId: string,
    private readonly refreshToken: string,
  ) {
    this.msalApp = new PublicClientApplication({
      auth: {
        clientId,
        authority: 'https://login.microsoftonline.com/consumers',
      },
    });
  }

  async getAccessToken(): Promise<string> {
    const result = await this.msalApp.acquireTokenByRefreshToken({
      refreshToken: this.refreshToken,
      scopes: ['Files.Read', 'offline_access'],
    });

    if (!result?.accessToken) {
      throw new Error(
        'Failed to refresh OneDrive access token — refresh token may be expired.',
      );
    }

    return result.accessToken;
  }
}