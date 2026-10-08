import { desc, eq } from "drizzle-orm";
import { applications, STAGES, type Stage } from "../db/schema";
import { builder } from "./builder";

type ApplicationRow = typeof applications.$inferSelect;

const StageEnum = builder.enumType("Stage", {
  values: STAGES,
});

const ApplicationType = builder.objectRef<ApplicationRow>("Application").implement({
  fields: (t) => ({
    id: t.exposeID("id"),
    company: t.exposeString("company"),
    role: t.exposeString("role"),
    url: t.exposeString("url", { nullable: true }),
    stage: t.field({ type: StageEnum, resolve: (app) => app.stage }),
    notes: t.exposeString("notes", { nullable: true }),
    followUpOn: t.exposeString("followUpOn", { nullable: true }),
    createdAt: t.exposeString("createdAt"),
    updatedAt: t.exposeString("updatedAt"),

    // SESSION TODO (DataLoader lesson): add `contacts` here.
    // 1. Implement naively (one query per application) and capture query counts.
    // 2. Convert to a dataloader via @pothos/plugin-dataloader.
    // 3. Record the before/after query counts in README "Metrics".
  }),
});

builder.queryFields((t) => ({
  applications: t.field({
    type: [ApplicationType],
    resolve: (_root, _args, ctx) =>
      ctx.db.select().from(applications).orderBy(desc(applications.updatedAt)).all(),
  }),
  application: t.field({
    type: ApplicationType,
    nullable: true,
    args: { id: t.arg.int({ required: true }) },
    resolve: (_root, args, ctx) =>
      ctx.db.select().from(applications).where(eq(applications.id, args.id)).get() ?? null,
  }),
}));

builder.mutationFields((t) => ({
  createApplication: t.field({
    type: ApplicationType,
    args: {
      company: t.arg.string({ required: true }),
      role: t.arg.string({ required: true }),
      url: t.arg.string(),
      stage: t.arg({ type: StageEnum }),
    },
    resolve: (_root, args, ctx) =>
      ctx.db
        .insert(applications)
        .values({
          company: args.company,
          role: args.role,
          url: args.url ?? null,
          stage: (args.stage as Stage | null) ?? "saved",
        })
        .returning()
        .get(),
  }),

  // SESSION TODO: updateApplicationStage, setFollowUp, addContact — one per
  // build session, each with a unit test, per PORTFOLIO_DIRECTION.md guardrails.
}));

export const schema = builder.toSchema();
