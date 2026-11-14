import { AtStakeCard } from "@/components/AtStakeCard";
import { ComparisonTable } from "@/components/ComparisonTable";
import { FlagCard } from "@/components/FlagCard";
import { Card, CardContent } from "@/components/ui/card";
import type { AnalysisResult } from "@/lib/schemas";

export function ReportView({ result }: { result: AnalysisResult }) {
  const { quote, changeOrder, matches, flags, atStakeCents } = result;

  return (
    <section className="space-y-5">
      <AtStakeCard atStakeCents={atStakeCents} flags={flags} />

      {flags.length > 0 ? (
        <div className="space-y-3">
          {flags.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              quote={quote}
              changeOrder={changeOrder}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm">
              We didn&apos;t find anything to question on this change order. The
              math adds up and nothing looks duplicated against your original
              quote.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 pt-2">
        <h3 className="text-base font-semibold tracking-tight">Line by line</h3>
        <Card>
          <CardContent className="px-0">
            <ComparisonTable
              quote={quote}
              changeOrder={changeOrder}
              matches={matches}
            />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
