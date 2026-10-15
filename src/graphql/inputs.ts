// GraphQL input types. TrafficFilter is the one "for whom and when" argument
// every traffic field accepts, so a client learns it once and passes the same
// variable to pages, metrics, and sessions. StepUsageInput is what an agent
// reports about the model call behind a step.
import type { TrafficFilter } from "@/db/queries/filter";
import type { StepUsage } from "@/db/queries/steps";
import { builder } from "./builder";
import { ConnectionTypeEnum, DeviceClassEnum } from "./enums";

export const TrafficFilterInput = builder.inputType("TrafficFilter", {
  description: "Narrow traffic to a half-open time window [from, to) and/or session dimensions. Every field is optional.",
  fields: (t) => ({
    from: t.field({ type: "DateTime" }),
    to: t.field({ type: "DateTime" }),
    deviceClass: t.field({ type: DeviceClassEnum }),
    connectionType: t.field({ type: ConnectionTypeEnum }),
  }),
});

type TrafficFilterInputShape = typeof TrafficFilterInput.$inferInput;

export const toTrafficFilter = (input: TrafficFilterInputShape | null | undefined): TrafficFilter => ({
  from: input?.from ?? null,
  to: input?.to ?? null,
  deviceClass: input?.deviceClass ?? null,
  connectionType: input?.connectionType ?? null,
});

export const StepUsageInput = builder.inputType("StepUsageInput", {
  description: "What the model call behind a step cost. Every field is optional; numbers must not be negative.",
  fields: (t) => ({
    model: t.string(),
    inputTokens: t.int(),
    outputTokens: t.int(),
    costUsd: t.float(),
  }),
});

type StepUsageInputShape = typeof StepUsageInput.$inferInput;

export const toStepUsage = (input: StepUsageInputShape | null | undefined): StepUsage | null =>
  input === null || input === undefined
    ? null
    : {
        model: input.model ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        costUsd: input.costUsd ?? null,
      };
