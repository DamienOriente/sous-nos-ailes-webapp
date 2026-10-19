import { handleOAuthCallback } from "@/app/api/integrations/oauth-handlers";

export async function GET(request: Request) {
  return handleOAuthCallback("microsoft", request);
}
