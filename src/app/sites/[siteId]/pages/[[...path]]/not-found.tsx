// What the page detail route shows when notFound() fires: the site id is not a
// site (mistyped, or from another database). Server-rendered, in the same
// shape as the incident route's not-found page. A path with no traffic is not
// this state; that is the empty state inside a found site.
import type { ReactElement } from "react";
import { NotFoundView } from "@/dashboard/components/NotFoundView";

export default function SiteNotFound(): ReactElement {
  return (
    <NotFoundView title="No such site">
      Nothing is recorded under this site id. It may belong to another database, or the link is out of date. The
      overview lists every site this dashboard knows.
    </NotFoundView>
  );
}
