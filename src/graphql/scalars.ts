// Custom scalars. DateTime exists because GraphQL's Int is 32-bit and cannot
// carry epoch milliseconds; resolvers keep numbers, clients see ISO strings.
import { GraphQLError, Kind } from "graphql";
import { z } from "zod";
import { builder } from "./builder";

// Date.parse alone also accepts "1" or "Oct 7 2026", and reads an offset-less
// time in the server's time zone, so the format is checked before parsing.
const isoDateTimeWithOffset = z.iso.datetime({ offset: true });

const parseDateTime = (value: unknown): number => {
  if (typeof value !== "string") {
    throw new GraphQLError("DateTime must be an ISO 8601 string");
  }
  if (!isoDateTimeWithOffset.safeParse(value).success) {
    throw new GraphQLError(`DateTime could not parse "${value}" as an ISO 8601 date-time with a UTC offset`);
  }
  return Date.parse(value);
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
