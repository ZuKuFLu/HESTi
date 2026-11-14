"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatUsd } from "@/lib/money";
import { computeTotals, listProjects, type Project } from "@/lib/projects";

/**
 * Projects are read in an effect, never during render: on the server, and on
 * the very first client render, localStorage does not exist yet.
 */
export function ProjectsList() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    setProjects(listProjects());
  }, []);

  if (projects === null || projects.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">Your projects</h2>
      <ul className="space-y-3">
        {projects.map((project) => {
          const totals = computeTotals(project);
          const count = project.changeOrders.length;

          return (
            <li key={project.id}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent>
                  <Link
                    href={`/p/${project.id}`}
                    className="flex items-center gap-4 outline-none focus-visible:underline"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium wrap-anywhere">
                        {project.name}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {count} change order{count === 1 ? "" : "s"}
                        {project.paid ? " · Project Pass" : ""}
                        {" · started "}
                        {formatDate(project.createdAt.slice(0, 10))}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">
                        {formatUsd(totals.currentCents)}
                      </p>
                      {totals.originalCents > 0 ? (
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {totals.percentOver} over quote
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
