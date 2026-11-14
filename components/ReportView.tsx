import { ComparisonTable } from "@/components/ComparisonTable";
import { FlagCard } from "@/components/FlagCard";
import { Card, CardContent } from "@/components/ui/card";
import { formatUsd } from "@/lib/money";
import type { AnalysisResult, Severity } from "@/lib/schemas";

const SEVERITY_LABELS: { key: Severity; label: string; className: string }[] = [
  { key: "high", label: "high", className: "text-red-700" },
  { key: "medium", label: "medium", className: "text-amber-700" },
  { key: "info", label: "info", className: "text-blue-700" },
];

export function ReportView({ result }: { result: AnalysisResult }) {
  const { quote, changeOrder, matches, flags, atStakeCents } = result;
  const counts = SEVERITY_LABELS.map((severity) => ({
    ...severity,
    count: flags.filter((flag) => flag.severity === severity.key).length,
  }));

  return (
    <section className="space-y-6">
      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Worth asking about</p>
            <p className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {formatUsd(atStakeCents)} at stake
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {counts.map((severity) => (
              <span key={severity.key} className={severity.count > 0 ? severity.className : "text-muted-foreground"}>
                <span className="font-semibold tabular-nums">{severity.count}</span>{" "}
                {severity.label}
              </span>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            Not legal, financial or construction advice. Flags are questions to ask, not
            accusations.
          </p>
        </CardContent>
      </Card>

      {flags.length > 0 ? (
        <div className="space-y-4">
          {flags.map((flag) => (
            <FlagCard key={flag.id} flag={flag} quote={quote} changeOrder={changeOrder} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm">
              We didn&apos;t find anything to question on this change order. The math adds
              up and nothing looks duplicated against your original quote.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Line by line</h2>
        <Card>
          <CardContent className="px-0">
            <ComparisonTable quote={quote} changeOrder={changeOrder} matches={matches} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
