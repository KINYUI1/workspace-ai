import { PrismaClient, Prisma } from '@prisma/client';
import { getPrismaClient } from '../../config/database';
import { NotFoundError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { getAdapter, ActionResult } from './integration-adapters';
import { OAuthService } from './oauth.service';

export class IntegrationExecutorService {
  private readonly db: PrismaClient;
  private readonly oauthService: OAuthService;

  constructor() {
    this.db = getPrismaClient();
    this.oauthService = new OAuthService();
  }

  /**
   * Execute an action on a connected integration
   */
  async executeAction(
    userId: string,
    integrationId: string,
    actionName: string,
    input: Record<string, unknown>,
  ): Promise<ActionResult> {
    const startTime = Date.now();

    // Get the user's connection
    const connection = await this.db.userIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
      include: { integration: true },
    });

    if (!connection || connection.status !== 'connected') {
      return { success: false, error: 'Integration is not connected' };
    }

    const adapter = getAdapter(connection.integration.slug);
    if (!adapter) {
      return { success: false, error: `No adapter available for ${connection.integration.name}` };
    }

    const credentials = connection.credentials as Record<string, unknown>;
    let result: ActionResult;

    try {
      result = await adapter.executeAction(actionName, input, credentials);
    } catch (err) {
      result = { success: false, error: (err as Error).message };
    }

    const executionTimeMs = Date.now() - startTime;

    // Log the action
    await this.db.integrationLog.create({
      data: {
        userIntegrationId: connection.id,
        action: actionName,
        status: result.success ? 'success' : 'error',
        requestPayload: input as Prisma.InputJsonValue,
        responsePayload: (result.success ? result.data : null) as Prisma.InputJsonValue,
        errorMessage: result.error || null,
        executionTimeMs,
      },
    });

    // Update lastUsedAt
    await this.db.userIntegration.update({
      where: { id: connection.id },
      data: { lastUsedAt: new Date() },
    });

    logger.info('Integration action executed', {
      userId,
      integration: connection.integration.name,
      action: actionName,
      success: result.success,
      executionTimeMs,
    });

    return result;
  }

  /**
   * Test if a connection's credentials are still valid
   */
  async testConnection(userId: string, integrationId: string): Promise<{ valid: boolean; error?: string }> {
    const connection = await this.db.userIntegration.findUnique({
      where: { userId_integrationId: { userId, integrationId } },
      include: { integration: true },
    });

    if (!connection) {
      return { valid: false, error: 'Connection not found' };
    }

    const adapter = getAdapter(connection.integration.slug);
    if (!adapter) {
      return { valid: false, error: 'No adapter available' };
    }

    const credentials = connection.credentials as Record<string, unknown>;
    const valid = await adapter.testConnection(credentials);

    if (!valid) {
      // Try refreshing the token if we have a refresh token
      const refreshToken = credentials.refreshToken as string | undefined;
      if (refreshToken && this.oauthService.isProviderConfigured(connection.integration.slug)) {
        try {
          const newTokens = await this.oauthService.refreshAccessToken(
            connection.integration.slug,
            refreshToken,
          );
          await this.db.userIntegration.update({
            where: { id: connection.id },
            data: {
              credentials: {
                ...credentials,
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken ?? refreshToken,
              } as Prisma.InputJsonValue,
            },
          });

          // Test again with new tokens
          const retryValid = await adapter.testConnection({
            ...credentials,
            accessToken: newTokens.accessToken,
          });
          if (retryValid) {
            return { valid: true };
          }
        } catch (err) {
          logger.warn('Token refresh failed', { integrationId, error: (err as Error).message });
        }
      }

      // Mark as error
      await this.db.userIntegration.update({
        where: { id: connection.id },
        data: { status: 'error' },
      });
      return { valid: false, error: 'Credentials are no longer valid' };
    }

    return { valid: true };
  }

  /**
   * Generate OAuth authorization URL for a provider
   */
  getAuthorizationUrl(userId: string, integrationSlug: string): string | null {
    return this.oauthService.generateAuthorizationUrl(userId, integrationSlug);
  }

  /**
   * Handle OAuth callback — exchange code for tokens, store connection
   */
  async handleOAuthCallback(code: string, state: string): Promise<{ success: boolean; integrationName?: string; error?: string }> {
    const stateData = this.oauthService.validateState(state);
    if (!stateData) {
      return { success: false, error: 'Invalid or expired OAuth state' };
    }

    const { userId, integrationSlug } = stateData;

    // Find the integration by slug
    const integration = await this.db.integration.findUnique({ where: { slug: integrationSlug } });
    if (!integration) {
      return { success: false, error: `Integration not found: ${integrationSlug}` };
    }

    try {
      const tokens = await this.oauthService.exchangeCodeForTokens(integrationSlug, code);

      // Test the connection before saving
      const adapter = getAdapter(integrationSlug);
      if (adapter) {
        const valid = await adapter.testConnection({ accessToken: tokens.accessToken });
        if (!valid) {
          return { success: false, error: 'Could not verify connection with the received tokens' };
        }
      }

      // Upsert connection
      await this.db.userIntegration.upsert({
        where: { userId_integrationId: { userId, integrationId: integration.id } },
        update: {
          status: 'connected',
          credentials: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: tokens.tokenType,
          } as Prisma.InputJsonValue,
          connectedAt: new Date(),
        },
        create: {
          userId,
          integrationId: integration.id,
          status: 'connected',
          credentials: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            tokenType: tokens.tokenType,
          } as Prisma.InputJsonValue,
        },
      });

      logger.info('OAuth connection established', { userId, integration: integrationSlug });
      return { success: true, integrationName: integration.name };
    } catch (err) {
      logger.error('OAuth callback failed', { integrationSlug, error: (err as Error).message });
      return { success: false, error: (err as Error).message };
    }
  }
}
