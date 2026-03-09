/**
 * Google Search Console Authentication Configuration
 *
 * Credentials are provided per-request via HTTP headers.
 * No credentials stored in env - the calling agent provides them.
 */

export interface GSCCredentials {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}

export interface GSCConfig {
  credentials: GSCCredentials;
}

/**
 * Load GSC configuration from environment variables (fallback)
 */
export function loadConfigFromEnv(): GSCConfig {
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GSC_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Missing required environment variables: GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN\n' +
        'Provide credentials via HTTP headers or .env file.'
    );
  }

  return {
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    },
  };
}
