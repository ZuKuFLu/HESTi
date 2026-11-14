"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, House, Sparkles } from "lucide-react";
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
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Your projects</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved in this browser. Come back when the next change order lands.
        </p>
      </div>

      <ul className="space-y-3">
        {projects.map((project) => {
          const totals = computeTotals(project);
          const count = project.changeOrders.length;
          const undecidedCents = totals.pendingCents + totals.disputedCents;

          return (
            <li key={project.id}>
              <Link
                href={`/p/${project.id}`}
                className="flex items-center gap-4 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 transition-all outline-none hover:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <House className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-medium wrap-anywhere">
                    {project.name}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                    <span>
                      {count} change order{count === 1 ? "" : "s"}
                    </span>
                    {project.paid ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        <Sparkles className="size-3" />
                        Pass
                      </span>
                    ) : null}
                    <span>
                      · started {formatDate(project.createdAt.slice(0, 10))}
                    </span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">
                    {formatUsd(totals.currentCents)}
                  </p>
                  {undecidedCents > 0 ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      + {formatUsd(undecidedCents)} awaiting you
                    </p>
                  ) : totals.originalCents > 0 ? (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {totals.percentOver} over quote
                    </p>
                  ) : null}
                </div>

                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
