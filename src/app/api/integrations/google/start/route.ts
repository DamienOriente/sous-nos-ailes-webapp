import { handleOAuthStart } from "@/app/api/integrations/oauth-handlers";

export async function GET() {
  return handleOAuthStart("google");
}
