import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/ui/StatusPill";
import { currencyFormat } from "@/lib/commission";
import { format } from "date-fns";

export default async function AdminTransactionsPage() {
  const supabase = await createClient();
  const { data: txns } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Transactions</h1>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-navy-400 border-b border-navy-100">
              <th className="p-4 font-medium">Date</th>
              <th className="p-4 font-medium">Type</th>
              <th className="p-4 font-medium">Amount</th>
              <th className="p-4 font-medium">Commission</th>
              <th className="p-4 font-medium">Gateway</th>
              <th className="p-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {txns?.map((t) => (
              <tr key={t.id} className="border-b border-navy-50 last:border-0">
                <td className="p-4 text-navy-400">{format(new Date(t.created_at), "d MMM, HH:mm")}</td>
                <td className="p-4 capitalize">{t.type.replace(/_/g, " ")}</td>
                <td className="p-4 fare-figure">{currencyFormat(Number(t.amount), t.currency)}</td>
                <td className="p-4 fare-figure text-navy-400">
                  {t.commission_amount ? `${currencyFormat(Number(t.commission_amount), t.currency)} (${t.commission_pct}%)` : "—"}
                </td>
                <td className="p-4 capitalize">{t.gateway || "—"}</td>
                <td className="p-4">
                  <StatusPill status={t.status} />
                </td>
              </tr>
            ))}
            {!txns?.length && (
              <tr>
                <td className="p-4 text-navy-400" colSpan={6}>
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
