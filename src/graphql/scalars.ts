// Custom scalars. DateTime exists because GraphQL's Int is 32-bit and cannot
// carry epoch milliseconds; resolvers keep numbers, clients see ISO strings.
import { GraphQLError, Kind } from "graphql";
import { builder } from "./builder";

const parseDateTime = (value: unknown): number => {
  if (typeof value !== "string") {
    throw new GraphQLError("DateTime must be an ISO 8601 string");
  }
  const epochMs = Date.parse(value);
  if (Number.isNaN(epochMs)) {
    throw new GraphQLError(`DateTime could not parse "${value}" as ISO 8601`);
  }
  return epochMs;
};

builder.scalarType("DateTime", {
  description: "An ISO 8601 date-time string, e.g. 2026-10-07T12:00:00.000Z.",
  serialize: (epochMs) => new Date(epochMs).toISOString(),
  parseValue: parseDateTime,
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError("DateTime must be an ISO 8601 string");
    }
    return parseDateTime(ast.value);
  },
});
