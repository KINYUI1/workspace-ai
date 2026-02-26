export interface ActionInput {
  [key: string]: unknown;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface IntegrationAdapter {
  slug: string;
  executeAction(actionName: string, input: ActionInput, credentials: Record<string, unknown>): Promise<ActionResult>;
  testConnection(credentials: Record<string, unknown>): Promise<boolean>;
}
