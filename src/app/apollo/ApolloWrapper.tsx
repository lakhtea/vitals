"use client";

// The one "use client" boundary that owns Apollo for the client tree. The
// Server Component layout renders it, and its children stay Server Components
// because they arrive here already rendered, not as imports.
import { ApolloNextAppProvider } from "@apollo/client-integration-nextjs";
import type { ReactElement, ReactNode } from "react";
import { makeClient } from "./make-client";

interface ApolloWrapperProps {
  children: ReactNode;
}

export const ApolloWrapper = ({ children }: ApolloWrapperProps): ReactElement => (
  <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>
);
