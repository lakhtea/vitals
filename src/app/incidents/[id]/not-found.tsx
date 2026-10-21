// What the incident route shows when notFound() fires: the id is not an
// incident (deleted, mistyped, or from another database). Server-rendered, in
// the same shape as the page detail route's not-found page.
import type { ReactElement } from "react";
import { NotFoundView } from "@/dashboard/components/NotFoundView";

export default function IncidentNotFound(): ReactElement {
  return (
    <NotFoundView title="No such incident">
      Nothing is recorded under this id. It may have been opened against another database, or the link is out of
      date. The overview lists every incident this site has.
    </NotFoundView>
  );
}
