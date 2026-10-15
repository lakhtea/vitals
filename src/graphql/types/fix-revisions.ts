// A proposed fix as the review panel and the agents read it: each immutable
// revision, its files, and the unified diff derived from them on read; plus
// the three Incident fields that reach them (history, latest, approved).
import {
  getFixRevision,
  getLatestFixRevision,
  isRevisionReviewed,
  listFilesForRevision,
  listFixRevisionsForIncident,
  toRevisionFile,
} from "@/db/queries/fix-revisions";
import type { FixRevisionFileRow, FixRevisionRow } from "@/db/schema";
import { unifiedFileDiff, unifiedRevisionDiff } from "@/incidents/diff";
import { builder } from "../builder";
import { FileActionEnum, FixAuthorEnum } from "../enums";
import { IncidentType } from "./incidents";

export const FixRevisionFileType = builder.objectRef<FixRevisionFileRow>("FixRevisionFile").implement({
  description: "One file a revision touches, as whole contents; the diff is derived from them.",
  fields: (t) => ({
    path: t.exposeString("path", { description: "Relative to the repository root." }),
    action: t.field({ type: FileActionEnum, resolve: (file) => file.action }),
    beforeContent: t.exposeString("beforeContent", { nullable: true, description: "Null for an added file." }),
    afterContent: t.exposeString("afterContent", { nullable: true, description: "Null for a deleted file." }),
    diff: t.string({
      description: "This file as a unified diff with three lines of context, a/ and b/ headers.",
      resolve: (file) => unifiedFileDiff(toRevisionFile(file)),
    }),
  }),
});

export const FixRevisionType = builder.objectRef<FixRevisionRow>("FixRevision").implement({
  description:
    "One immutable version of the change proposed for an incident. An agent submits revision 1; each human edit writes the next.",
  fields: (t) => ({
    id: t.exposeID("id"),
    number: t.exposeInt("number", { description: "1-based per incident." }),
    author: t.field({ type: FixAuthorEnum, resolve: (revision) => revision.author }),
    createdAt: t.field({ type: "DateTime", resolve: (revision) => revision.createdAt }),
    targetRepo: t.exposeString("targetRepo", { description: '"owner/name" of the repository the change applies to.' }),
    baseSha: t.exposeString("baseSha", { description: "The commit the before contents were read at." }),
    summary: t.exposeString("summary"),
    files: t.field({
      type: [FixRevisionFileType],
      description: "In submission order. One statement per revision.",
      resolve: (revision, _args, ctx) => listFilesForRevision({ db: ctx.db, revisionId: revision.id }),
    }),
    diff: t.string({
      description: "Every file's unified diff, joined in submission order. One statement per revision.",
      resolve: (revision, _args, ctx) =>
        unifiedRevisionDiff(listFilesForRevision({ db: ctx.db, revisionId: revision.id }).map(toRevisionFile)),
    }),
    reviewed: t.boolean({
      description: "True when a REVIEW step that SUCCEEDED started at or after this revision was created.",
      resolve: (revision, _args, ctx) => isRevisionReviewed({ db: ctx.db, revision }),
    }),
  }),
});

builder.objectFields(IncidentType, (t) => ({
  fixRevisions: t.field({
    type: [FixRevisionType],
    description: "Every revision of the proposed fix, oldest first; empty when none was proposed. One statement per incident.",
    resolve: (incident, _args, ctx) => listFixRevisionsForIncident({ db: ctx.db, incidentId: incident.id }),
  }),
  latestFixRevision: t.field({
    type: FixRevisionType,
    nullable: true,
    description: "The revision a person reviews and approves; null when no fix was proposed.",
    resolve: (incident, _args, ctx) => getLatestFixRevision({ db: ctx.db, incidentId: incident.id }) ?? null,
  }),
  approvedRevision: t.field({
    type: FixRevisionType,
    nullable: true,
    description: "The revision pinned when the incident was approved; null otherwise.",
    resolve: (incident, _args, ctx) =>
      incident.approvedRevisionId === null ? null : (getFixRevision({ db: ctx.db, id: incident.approvedRevisionId }) ?? null),
  }),
}));
