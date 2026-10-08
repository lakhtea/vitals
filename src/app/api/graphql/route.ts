// The GraphQL endpoint. Yoga speaks the Fetch API's Request/Response, which is
// exactly what a Next.js route handler expects, so the glue is three lines.
import { createYoga } from "graphql-yoga";
import { isDemoMode } from "@/config/demo-mode";
import { createContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  // The public demo keeps POST open for the dashboard but hides the GraphiQL
  // page: an interactive console on a public URL invites ad hoc load.
  graphiql: !isDemoMode(),
  // Yoga must build the WHATWG Response class Next.js expects to be returned.
  fetchAPI: { Response },
});

// GET serves GraphiQL (outside demo mode); POST carries queries. Thin wrappers match Next 16's typed route signature.
const handle = async (request: Request): Promise<Response> => yoga.handleRequest(request, {});

export { handle as GET, handle as POST, handle as OPTIONS };
