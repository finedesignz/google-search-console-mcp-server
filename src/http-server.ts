/**
 * HTTP Server for Google Search Console MCP Tools
 *
 * Provides HTTP REST API access with header-based authentication.
 * Agent provides OAuth credentials via headers - no credentials stored in env.
 * Token refresh is handled automatically by the googleapis library.
 */

import { timingSafeEqual } from 'crypto';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { createClient, SearchConsoleClient } from './client/index.js';
import { GSCCredentials } from './auth/index.js';
import {
  listSites,
  getSite,
  addSite,
  deleteSite,
  querySearchAnalytics,
  listSitemaps,
  getSitemap,
  submitSitemap,
  deleteSitemap,
  inspectUrl,
} from './tools/index.js';

// Extend Express Request to carry the client
declare global {
  namespace Express {
    interface Request {
      gscClient?: SearchConsoleClient;
    }
  }
}

/**
 * Extract GSC credentials from request headers
 */
function extractCredentials(req: Request): GSCCredentials | null {
  const clientId = req.headers['gsc-client-id'] as string;
  const clientSecret = req.headers['gsc-client-secret'] as string;
  const refreshToken = req.headers['gsc-refresh-token'] as string;

  if (clientId && clientSecret && refreshToken) {
    return {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    };
  }

  // Fallback to env
  const envClientId = process.env.GSC_CLIENT_ID;
  const envClientSecret = process.env.GSC_CLIENT_SECRET;
  const envRefreshToken = process.env.GSC_REFRESH_TOKEN;

  if (envClientId && envClientSecret && envRefreshToken) {
    return {
      client_id: envClientId,
      client_secret: envClientSecret,
      refresh_token: envRefreshToken,
    };
  }

  return null;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Middleware: validate API key if configured
 */
function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = process.env.MCP_API_KEY;
  if (!apiKey) {
    // No API key configured - allow unauthenticated access
    // Credentials are still required per-request for tool calls
    next();
    return;
  }

  // Skip API key check for health endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  const authHeader = (req.headers['authorization'] as string) || '';
  if (safeCompare(authHeader, `Bearer ${apiKey}`)) {
    next();
    return;
  }

  res.status(401).json({
    error: { code: 'unauthorized', message: 'Invalid or missing API key' },
  });
}

/**
 * Middleware: create GSC client from request credentials
 */
function credentialsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip for health/info endpoints
  if (
    req.path === '/health' ||
    req.path === '/mcp' ||
    (req.path === '/tools' && req.method === 'GET')
  ) {
    next();
    return;
  }

  const credentials = extractCredentials(req);
  if (!credentials) {
    res.status(401).json({
      error: {
        code: 'missing_credentials',
        message:
          'Google OAuth credentials required. Provide GSC-Client-ID, GSC-Client-Secret, and GSC-Refresh-Token headers.',
      },
    });
    return;
  }

  req.gscClient = createClient(credentials);
  next();
}

/**
 * Classify error for appropriate HTTP status code
 */
function classifyError(error: Error): number {
  const msg = error.message.toLowerCase();
  if (
    msg.includes('invalid_client') ||
    msg.includes('invalid_grant') ||
    msg.includes('unauthorized') ||
    msg.includes('token has been expired') ||
    msg.includes('token has been revoked')
  ) {
    return 401;
  }
  if (msg.includes('forbidden') || msg.includes('permission')) {
    return 403;
  }
  if (msg.includes('not found') || msg.includes('does not exist')) {
    return 404;
  }
  if (msg.includes('rate limit') || msg.includes('quota')) {
    return 429;
  }
  return 500;
}

/**
 * Error handling middleware
 */
function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log full error server-side only
  console.error('[HTTP] Error:', error.message);

  if (error instanceof McpError) {
    let statusCode: number;
    if (error.code === ErrorCode.InvalidParams) {
      statusCode = 400;
    } else if (error.code === ErrorCode.MethodNotFound) {
      statusCode = 404;
    } else {
      statusCode = 500;
    }
    res.status(statusCode).json({
      error: { code: error.code, message: error.message },
    });
  } else {
    const statusCode = classifyError(error);
    // Return sanitized error - don't leak internal details
    const safeMessage =
      statusCode === 500
        ? 'An internal error occurred'
        : error.message;
    res.status(statusCode).json({
      error: { code: 'error', message: safeMessage },
    });
  }
}

/**
 * Create and configure Express server
 */
export function createHttpServer(port = 9100): {
  app: express.Application;
  start: () => Promise<void>;
} {
  const app = express();

  // Security: restrict CORS to configured origins, or allow all if not set
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',');
  app.use(
    cors(
      allowedOrigins
        ? { origin: allowedOrigins }
        : undefined
    )
  );

  // Body size limit to prevent oversized payloads
  app.use(express.json({ limit: '100kb' }));
  app.use(apiKeyMiddleware);
  app.use(credentialsMiddleware);

  // Disable x-powered-by header
  app.disable('x-powered-by');

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      server: 'google-search-console-mcp-server',
      version: '0.1.0',
      transport: 'http',
    });
  });

  // MCP info endpoint
  app.get('/mcp', (_req, res) => {
    res.json({
      name: 'google-search-console-mcp-server',
      version: '0.1.0',
      description: 'Google Search Console API MCP Server',
      protocol: 'mcp',
      tools: 10,
    });
  });

  // List available tools
  app.get('/tools', (_req, res) => {
    res.json({
      tools: [
        'list_sites',
        'get_site',
        'add_site',
        'delete_site',
        'query_search_analytics',
        'list_sitemaps',
        'get_sitemap',
        'submit_sitemap',
        'delete_sitemap',
        'inspect_url',
      ],
      count: 10,
    });
  });

  // Tool execution endpoint
  app.post('/tools/:toolName', async (req, res, next) => {
    try {
      const { toolName } = req.params;
      const args = req.body;
      const client = req.gscClient!;

      let result;

      switch (toolName) {
        // Sites
        case 'list_sites':
          result = await listSites(client);
          break;
        case 'get_site':
          result = await getSite(client, args);
          break;
        case 'add_site':
          result = await addSite(client, args);
          break;
        case 'delete_site':
          result = await deleteSite(client, args);
          break;

        // Search Analytics
        case 'query_search_analytics':
          result = await querySearchAnalytics(client, args);
          break;

        // Sitemaps
        case 'list_sitemaps':
          result = await listSitemaps(client, args);
          break;
        case 'get_sitemap':
          result = await getSitemap(client, args);
          break;
        case 'submit_sitemap':
          result = await submitSitemap(client, args);
          break;
        case 'delete_sitemap':
          result = await deleteSitemap(client, args);
          break;

        // URL Inspection
        case 'inspect_url':
          result = await inspectUrl(client, args);
          break;

        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${toolName}`
          );
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use(errorHandler);

  return {
    app,
    async start() {
      if (!process.env.MCP_API_KEY) {
        console.warn(
          'WARNING: MCP_API_KEY not set. Tool endpoints require GSC credentials but have no API key gate.'
        );
      }

      return new Promise<void>((resolve) => {
        app.listen(port, '0.0.0.0', () => {
          console.log(`Google Search Console MCP Server (HTTP Mode)`);
          console.log(`  Port: ${port}`);
          console.log(`  Health: http://localhost:${port}/health`);
          console.log(`  Tools: http://localhost:${port}/tools`);
          console.log(`\nCredentials: Provide via headers per request`);
          console.log(
            `  GSC-Client-ID, GSC-Client-Secret, GSC-Refresh-Token`
          );
          resolve();
        });
      });
    },
  };
}
