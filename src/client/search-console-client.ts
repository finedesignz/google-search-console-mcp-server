/**
 * Google Search Console API Client
 *
 * Wraps the googleapis library with automatic token refresh.
 * Creates a new OAuth2 client per request using provided credentials.
 */

import { google, searchconsole_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GSCCredentials } from '../auth/config.js';

export class SearchConsoleClient {
  private oauth2Client: OAuth2Client;
  private searchConsole: searchconsole_v1.Searchconsole;

  constructor(credentials: GSCCredentials) {
    this.oauth2Client = new google.auth.OAuth2(
      credentials.client_id,
      credentials.client_secret
    );

    this.oauth2Client.setCredentials({
      refresh_token: credentials.refresh_token,
    });

    this.searchConsole = google.searchconsole({
      version: 'v1',
      auth: this.oauth2Client,
    });
  }

  /**
   * Test connection by listing sites
   */
  async testConnection(): Promise<boolean> {
    const res = await this.searchConsole.sites.list();
    return res.status === 200;
  }

  // ========== Sites ==========

  async listSites(): Promise<searchconsole_v1.Schema$SitesListResponse> {
    const res = await this.searchConsole.sites.list();
    return res.data;
  }

  async getSite(siteUrl: string): Promise<searchconsole_v1.Schema$WmxSite> {
    const res = await this.searchConsole.sites.get({ siteUrl });
    return res.data;
  }

  async addSite(siteUrl: string): Promise<void> {
    await this.searchConsole.sites.add({ siteUrl });
  }

  async deleteSite(siteUrl: string): Promise<void> {
    await this.searchConsole.sites.delete({ siteUrl });
  }

  // ========== Search Analytics ==========

  async querySearchAnalytics(
    siteUrl: string,
    params: searchconsole_v1.Schema$SearchAnalyticsQueryRequest
  ): Promise<searchconsole_v1.Schema$SearchAnalyticsQueryResponse> {
    const res = await this.searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: params,
    });
    return res.data;
  }

  // ========== Sitemaps ==========

  async listSitemaps(
    siteUrl: string
  ): Promise<searchconsole_v1.Schema$SitemapsListResponse> {
    const res = await this.searchConsole.sitemaps.list({ siteUrl });
    return res.data;
  }

  async getSitemap(
    siteUrl: string,
    feedpath: string
  ): Promise<searchconsole_v1.Schema$WmxSitemap> {
    const res = await this.searchConsole.sitemaps.get({ siteUrl, feedpath });
    return res.data;
  }

  async submitSitemap(siteUrl: string, feedpath: string): Promise<void> {
    await this.searchConsole.sitemaps.submit({ siteUrl, feedpath });
  }

  async deleteSitemap(siteUrl: string, feedpath: string): Promise<void> {
    await this.searchConsole.sitemaps.delete({ siteUrl, feedpath });
  }

  // ========== URL Inspection ==========

  async inspectUrl(
    inspectionUrl: string,
    siteUrl: string,
    languageCode?: string
  ): Promise<searchconsole_v1.Schema$InspectUrlIndexResponse> {
    const res = await this.searchConsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl,
        siteUrl,
        languageCode: languageCode || 'en',
      },
    });
    return res.data;
  }
}

/**
 * Create a client from request-scoped credentials
 */
export function createClient(credentials: GSCCredentials): SearchConsoleClient {
  return new SearchConsoleClient(credentials);
}

/**
 * Get credentials from environment (for stdio mode)
 */
export function getEnvCredentials(): GSCCredentials {
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = process.env.GSC_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('GSC credentials not configured');
  }

  return {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  };
}
