/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  callbackPath: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

// In-memory state store (short-lived, cleared on token exchange)
const pendingStates = new Map<string, { userId: string; integrationSlug: string; expiresAt: number }>();

const PROVIDER_CONFIGS: Record<string, () => OAuthConfig | null> = {
  github: () => {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;
    return {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      scopes: ['repo', 'read:user', 'user:email'],
      callbackPath: '/api/integrations/oauth/callback',
    };
  },
  slack: () => {
    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) return null;
    return {
      clientId: env.SLACK_CLIENT_ID,
      clientSecret: env.SLACK_CLIENT_SECRET,
      authorizeUrl: 'https://slack.com/oauth/v2/authorize',
      tokenUrl: 'https://slack.com/api/oauth.v2.access',
      scopes: ['chat:write', 'channels:read', 'channels:history', 'users:read'],
      callbackPath: '/api/integrations/oauth/callback',
    };
  },
  'google-drive': () => googleConfig(['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly']),
  gmail: () => googleConfig(['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send']),
  'google-calendar': () => googleConfig(['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events']),
  'google-analytics': () => googleConfig(['https://www.googleapis.com/auth/analytics.readonly']),
};

function googleConfig(scopes: string[]): OAuthConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes,
    callbackPath: '/api/integrations/oauth/callback',
  };
}

export class OAuthService {
  getProviderConfig(slug: string): OAuthConfig | null {
    const configFn = PROVIDER_CONFIGS[slug];
    return configFn ? configFn() : null;
  }

  isProviderConfigured(slug: string): boolean {
    return this.getProviderConfig(slug) !== null;
  }

  generateAuthorizationUrl(userId: string, integrationSlug: string): string | null {
    const config = this.getProviderConfig(integrationSlug);
    if (!config) return null;

    const state = crypto.randomBytes(32).toString('hex');
    pendingStates.set(state, {
      userId,
      integrationSlug,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 min
    });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${env.OAUTH_CALLBACK_BASE_URL}${config.callbackPath}`,
      scope: config.scopes.join(' '),
      state,
      response_type: 'code',
    });

    // Google requires access_type=offline for refresh tokens
    if (integrationSlug.startsWith('google') || integrationSlug === 'gmail') {
      params.set('access_type', 'offline');
      params.set('prompt', 'consent');
    }

    return `${config.authorizeUrl}?${params.toString()}`;
  }

  validateState(state: string): { userId: string; integrationSlug: string } | null {
    const pending = pendingStates.get(state);
    if (!pending) return null;
    if (Date.now() > pending.expiresAt) {
      pendingStates.delete(state);
      return null;
    }
    pendingStates.delete(state);
    return { userId: pending.userId, integrationSlug: pending.integrationSlug };
  }

  async exchangeCodeForTokens(integrationSlug: string, code: string): Promise<OAuthTokens> {
    const config = this.getProviderConfig(integrationSlug);
    if (!config) throw new Error(`No OAuth config for ${integrationSlug}`);

    const body: Record<string, string> = {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: `${env.OAUTH_CALLBACK_BASE_URL}${config.callbackPath}`,
    };

    // GitHub uses a different grant_type pattern
    if (integrationSlug === 'github') {
      // GitHub doesn't need grant_type
    } else {
      body.grant_type = 'authorization_code';
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    };

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams(body).toString(),
    });

    const data = await response.json() as any;

    if (!response.ok || data.error) {
      logger.error('OAuth token exchange failed', { integrationSlug, error: data.error || data });
      throw new Error(`Token exchange failed: ${data.error_description || data.error || 'Unknown error'}`);
    }

    // Slack has a different response structure
    if (integrationSlug === 'slack') {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        tokenType: data.token_type,
        scope: data.scope,
      };
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  async refreshAccessToken(integrationSlug: string, refreshToken: string): Promise<OAuthTokens> {
    const config = this.getProviderConfig(integrationSlug);
    if (!config) throw new Error(`No OAuth config for ${integrationSlug}`);

    const body = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    });

    const data = await response.json() as any;

    if (!response.ok || data.error) {
      throw new Error(`Token refresh failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? refreshToken,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  // Cleanup expired states periodically
  static cleanup() {
    const now = Date.now();
    for (const [key, val] of pendingStates) {
      if (now > val.expiresAt) pendingStates.delete(key);
    }
  }
}
