import { createYoga } from "graphql-yoga";
import { createContext } from "../../../graphql/context";
import { schema } from "../../../graphql/schema";

const yoga = createYoga({
  schema,
  context: createContext,
  graphqlEndpoint: "/api/graphql",
  // Yoga needs the WHATWG Response class Next.js expects to be returned.
  fetchAPI: { Response },
});

// Thin wrappers so the handlers match Next 16's typed route signature.
const handle = (request: Request) => yoga.handleRequest(request, {});

export { handle as GET, handle as POST, handle as OPTIONS };
