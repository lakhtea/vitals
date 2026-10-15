"use client";

// Wires the proposed-change panel to the API: saves a person's edit as a new
// revision through editFixRevision, then asks Next.js to re-render the page's
// Server Components so the diff, history, and timeline show it. Same pattern
// as IncidentDecision; the panel itself takes plain props.
import { useMutation } from "@apollo/client/react";
import { useRouter } from "next/navigation";
import { useTransition, type ReactElement } from "react";
import { EDIT_FIX_REVISION } from "../queries";
import { FixReview, type FixRevisionData, type FixRevisionSummary } from "./FixReview";

export interface IncidentFixReviewProps {
  revision: FixRevisionData;
  history: FixRevisionSummary[];
  editable: boolean;
}

export const IncidentFixReview = ({ revision, history, editable }: IncidentFixReviewProps): ReactElement => {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [editRevision, editState] = useMutation(EDIT_FIX_REVISION);

  // A failed save rejects, which keeps the editor open so nothing typed is lost; the hook's error is shown.
  const save: IncidentFixReviewSave = async ({ revisionId, files, note }) => {
    await editRevision({ variables: { revisionId, files, note: note === "" ? null : note } });
    startRefresh(() => router.refresh());
  };

  return (
    <FixReview
      revision={revision}
      history={history}
      editable={editable}
      onSave={save}
      busy={editState.loading || isRefreshing}
      error={editState.error?.message ?? null}
    />
  );
};

type IncidentFixReviewSave = Parameters<typeof FixReview>[0]["onSave"];
