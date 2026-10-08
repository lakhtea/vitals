// The ingest endpoint the browser library posts to. Thin on purpose: the
// handler in src/collect does the work and is tested without a server.
import { corsPreflightResponse, handleCollect } from "@/collect/handle";
import { getDb } from "@/db";

export const POST = (request: Request): Promise<Response> => handleCollect({ request, db: getDb() });

export const OPTIONS = (): Response => corsPreflightResponse();
