// What every resolver receives as its third argument. Passing the database in,
// rather than importing it, is what lets tests run the schema on :memory:.
import { GraphQLError } from "graphql";
import { bearerToken, isSameSecret } from "@/auth/bearer";
import { getDb, type Db } from "@/db";

export interface Context {
  db: Db;
  /**
   * True when the request carried `Authorization: Bearer <VITALS_SERVICE_TOKEN>`:
   * the caller is one of our agents (through the MCP server), not a browser.
   */
  isService: boolean;
}

/** False whenever the server has no token configured, so an unset env var can never be matched. */
const presentsServiceToken = (request: Request | undefined): boolean => {
  const expected = process.env.VITALS_SERVICE_TOKEN;
  if (request === undefined || expected === undefined || expected === "") {
    return false;
  }
  const presented = bearerToken(request);
  return presented !== null && isSameSecret({ presented, expected });
};

/**
 * Yoga calls this once per request with the incoming Request. The in-process
 * RSC client calls it with nothing: server rendering is never an agent.
 */
export const createContext = ({ request }: { request?: Request } = {}): Context => ({
  db: getDb(),
  isService: presentsServiceToken(request),
});

/** Guards the mutations only agents call; throws before the resolver reads anything. */
export const requireService = (ctx: Context): void => {
  if (!ctx.isService) {
    throw new GraphQLError("This operation needs the service token: send Authorization: Bearer <VITALS_SERVICE_TOKEN>", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
};
