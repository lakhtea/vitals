// A tiny GraphQL-over-HTTP client: the MCP server's only way into Vitals. It
// posts typed documents to the dashboard's /api/graphql with the service token,
// so an agent can do exactly what the schema allows and nothing more.
import type { TypedDocumentNode } from "@graphql-typed-document-node/core";
import { print } from "graphql";

export interface VitalsClientOptions {
  /** The dashboard's origin, e.g. http://localhost:3000 (no trailing path). */
  url: string;
  /** Sent as `Authorization: Bearer <token>`; the agent-only mutations require it. */
  serviceToken: string;
  /** Injectable so tests can point the client at an in-process server. */
  fetch?: typeof fetch;
}

export interface VitalsClient {
  request: <TData, TVariables>(document: TypedDocumentNode<TData, TVariables>, variables: TVariables) => Promise<TData>;
}

/** A request the server refused or could not answer; `messages` are the GraphQL error messages, verbatim. */
export class VitalsRequestError extends Error {
  readonly messages: readonly string[];

  constructor(messages: readonly string[]) {
    super(messages.join("; "));
    this.name = "VitalsRequestError";
    this.messages = messages;
  }
}

interface GraphQLResponseBody<TData> {
  data?: TData | null;
  errors?: ReadonlyArray<{ message: string }>;
}

const readBody = async <TData>(response: Response): Promise<GraphQLResponseBody<TData>> => {
  try {
    return (await response.json()) as GraphQLResponseBody<TData>;
  } catch {
    throw new VitalsRequestError([`Vitals answered HTTP ${response.status} without a GraphQL body`]);
  }
};

export const createVitalsClient = ({ url, serviceToken, fetch: fetchImpl = fetch }: VitalsClientOptions): VitalsClient => {
  const endpoint = new URL("/api/graphql", url).toString();

  // "fetch failed" tells an agent nothing; naming the URL tells it the dashboard is down.
  const send = async (init: RequestInit): Promise<Response> => {
    try {
      return await fetchImpl(endpoint, init);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new VitalsRequestError([`Could not reach Vitals at ${endpoint} (${reason}); is the dashboard running?`]);
    }
  };

  const request = async <TData, TVariables>(
    document: TypedDocumentNode<TData, TVariables>,
    variables: TVariables,
  ): Promise<TData> => {
    const response = await send({
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/graphql-response+json, application/json",
        authorization: `Bearer ${serviceToken}`,
      },
      body: JSON.stringify({ query: print(document), variables }),
    });
    const body = await readBody<TData>(response);
    // GraphQL reports partial failures beside partial data; an agent acting on
    // half an answer is worse than one told plainly that the call failed.
    if (body.errors && body.errors.length > 0) {
      throw new VitalsRequestError(body.errors.map((error) => error.message));
    }
    if (body.data === undefined || body.data === null) {
      throw new VitalsRequestError([`Vitals answered HTTP ${response.status} with no data`]);
    }
    return body.data;
  };

  return { request };
};
