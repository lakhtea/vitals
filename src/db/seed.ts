/**
 * Demo-mode seed — gives interviewers (and E2E tests) something real to look at.
 * Idempotent: only inserts when the applications table is empty.
 *
 * Run with: npm run db:seed
 */
import { applications, contacts } from "./schema";
import { makeDb } from "./index";

export function seed(db = makeDb()) {
  const existing = db.select({ id: applications.id }).from(applications).limit(1).all();
  if (existing.length > 0) {
    console.log("db already seeded — skipping");
    return;
  }

  const rows = db
    .insert(applications)
    .values([
      {
        company: "Netflix",
        role: "Senior UI Engineer, Design Systems",
        stage: "interviewing",
        followUpOn: "2026-08-14",
        notes: "Design-systems + client-observability track. Demo Vitals dashboard.",
      },
      {
        company: "Figma",
        role: "Design Systems Engineer",
        stage: "screening",
        followUpOn: "2026-08-12",
        notes: "Mention token-export Figma plugin idea.",
      },
      {
        company: "Squarespace",
        role: "Senior Software Engineer, Frontend Platform",
        stage: "applied",
        followUpOn: "2026-08-17",
      },
      {
        company: "Grafana Labs",
        role: "Senior Frontend Engineer, Observability",
        stage: "saved",
        notes: "Faro contribution would be strong signal here.",
      },
    ])
    .returning({ id: applications.id })
    .all();

  db.insert(contacts)
    .values([
      {
        applicationId: rows[0].id,
        name: "Alex Rivera",
        role: "Hiring manager",
        email: "alex@example.com",
      },
      {
        applicationId: rows[1].id,
        name: "Sam Chen",
        role: "Recruiter",
        email: "sam@example.com",
      },
    ])
    .run();

  console.log(`seeded ${rows.length} applications`);
}

// Allow `tsx src/db/seed.ts` direct execution.
if (process.argv[1]?.endsWith("seed.ts")) {
  seed();
}
