// The GraphQL endpoint. Yoga speaks the Fetch API's Request/Response, which is
// exactly what a Next.js route handler expects, so the glue is three lines.
import { createYoga } from "graphql-yoga";
import { createContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  // Yoga must build the WHATWG Response class Next.js expects to be returned.
  fetchAPI: { Response },
});

// GET serves GraphiQL; POST carries queries. Thin wrappers match Next 16's typed route signature.
const handle = async (request: Request): Promise<Response> => yoga.handleRequest(request, {});

export { handle as GET, handle as POST, handle as OPTIONS };
