"use client";

import React, { useEffect, useMemo, useState } from "react";
import TokenPriceChart from "../components/TokenPriceChart";

type Suggestion = {
  token: string;
  symbol: string;
  address: string;
  summary: string;
};

interface AdvancedPageProps {
  searchParams?: {
    token?: string;
    address?: string;
  };
}

export default function AdvancedPage({ searchParams }: AdvancedPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/ai/suggestions", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load suggestions");
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selected = useMemo(() => {
    if (!suggestions.length) return null;

    // If a token or address is provided in the query string,
    // prefer that suggestion when rendering the chart.
    const tokenParam = searchParams?.token?.toLowerCase();
    const addrParam = searchParams?.address?.toLowerCase();

    if (tokenParam || addrParam) {
      const match = suggestions.find((s) => {
        if (addrParam && s.address.toLowerCase() === addrParam) return true;
        if (tokenParam && s.symbol.toLowerCase() === tokenParam) return true;
        return false;
      });
      if (match) return match;
    }

    return suggestions[0];
  }, [suggestions, searchParams]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Advanced</h1>
        <p className="text-sm text-gray-500 mt-1">
          AI-driven token suggestions and live charts powered by POL Pump AI.
        </p>
      </div>

      {/* Live token chart + commentary */}
      {selected && (
        <TokenPriceChart
          tokenAddress={selected.address}
          tokenSymbol={selected.symbol}
        />
      )}

      {loading && (
        <div className="mt-4 text-sm text-gray-500">
          Loading AI suggestions…
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-500 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((s) => (
            <div key={s.address} className="border rounded-lg p-4 bg-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium">{s.token}</div>
                  <div className="text-xs text-gray-400">
                    {s.symbol} • {s.address.slice(0, 6)}…
                    {s.address.slice(-4)}
                  </div>
                </div>
                <a
                  className="text-sm px-3 py-1 rounded bg-blue-600 text-white"
                  href={`/tokens/${s.address}`}
                >
                  View Token
                </a>
              </div>
              <p className="text-sm mt-3 leading-6 whitespace-pre-wrap">
                {s.summary}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-xs text-gray-400">
        Note: If AI Compute broker isn't configured, this page shows mock data.
        Configure PRIVATE_KEY and broker package to enable live AI.
      </div>
    </div>
  );
}

