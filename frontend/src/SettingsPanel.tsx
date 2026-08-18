import { useEffect, useState } from "react";
import { toast } from "./toast";

type KeyRow = { set: boolean; mask: string };

type SettingsBody = {
  keys?: { fal?: KeyRow; xai?: KeyRow; runware?: KeyRow };
  dashboards?: Record<string, string>;
  paths?: {
    outputs?: string;
    resolve_inbox?: string | null;
    resolve_inbox_note?: string | null;
    resolve_outbox?: string;
  };
  preferences?: { theme?: string; retention_days?: number };
};

type BalanceRow = {
  ok?: boolean;
  label?: string;
  detail?: string;
  billing_url?: string;
  amount?: number | null;
};

type SpendMonth = {
  month: string;
  total: number;
  count: number;
  by_provider?: { provider: string; total: number }[];
};

type SpendBody = {
  this_month?: {
    month: string;
    total: number;
    count: number;
    by_provider?: { provider: string; total: number; count: number }[];
  };
  months?: SpendMonth[];
};

type Props = {
  open: boolean;
  onClose: () => void;
};

function money(n: number | undefined) {
  if (n == null) return "$0.00";
  return `$${n.toFixed(2)}`;
}

export default function SettingsPanel({ open, onClose }: Props) {
  const [settings, setSettings] = useState<SettingsBody | null>(null);
  const [falDraft, setFalDraft] = useState("");
  const [xaiDraft, setXaiDraft] = useState("");
  const [runwareDraft, setRunwareDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [balances, setBalances] = useState<Record<string, BalanceRow>>({});
  const [balBusy, setBalBusy] = useState(false);
  const [spend, setSpend] = useState<SpendBody | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retention, setRetention] = useState(90);
  const [retentionNever, setRetentionNever] = useState(false);

  async function loadSettings() {
    const res = await fetch("/settings");
    if (!res.ok) throw new Error(`Settings ${res.status}`);
    const body = (await res.json()) as SettingsBody;
    setSettings(body);
    const days = body.preferences?.retention_days;
    if (days == null) {
      setRetention(90);
      setRetentionNever(false);
    } else if (days <= 0) {
      setRetention(0);
      setRetentionNever(true);
    } else {
      setRetention(days);
      setRetentionNever(false);
    }
  }

  async function loadSpend() {
    const res = await fetch("/settings/spend?granularity=month");
    if (!res.ok) throw new Error(`Spend ${res.status}`);
    setSpend((await res.json()) as SpendBody);
  }

  async function loadBalances() {
    setBalBusy(true);
    try {
      const res = await fetch("/settings/balances");
      if (!res.ok) throw new Error(`Balances ${res.status}`);
      const body = (await res.json()) as {
        fal?: BalanceRow;
        xai?: BalanceRow;
        runware?: BalanceRow;
      };
      setBalances({
        fal: body.fal ?? {},
        xai: body.xai ?? {},
        runware: body.runware ?? {},
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Balance refresh failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setBalBusy(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setError(null);
    void loadSettings().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load settings.");
    });
    void loadSpend().catch(() => undefined);
    void loadBalances();
  }, [open]);

  async function saveKeys() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/settings/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fal_key: falDraft.trim() || null,
          xai_api_key: xaiDraft.trim() || null,
          runware_key: runwareDraft.trim() || null,
        }),
      });
      const body = (await res.json()) as SettingsBody & { detail?: string };
      if (!res.ok) throw new Error(body.detail || "Save failed.");
      setSettings(body);
      setFalDraft("");
      setXaiDraft("");
      setRunwareDraft("");
      toast("Keys saved.");
      void loadBalances();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed.";
      setError(msg);
      toast(msg, true);
    } finally {
      setSaving(false);
    }
  }

  async function openPath(which: string) {
    try {
      const res = await fetch("/settings/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ which }),
      });
      const body = (await res.json()) as { detail?: string };
      if (!res.ok) throw new Error(body.detail || "Could not open folder.");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not open folder.", true);
    }
  }

  async function saveRetention() {
    try {
      const days = retentionNever ? 0 : Math.max(0, Number(retention) || 0);
      const res = await fetch("/settings/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ retention_days: days }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        detail?: string;
        preferences?: { retention_days?: number };
      };
      if (!res.ok || body.ok === false) {
        throw new Error(body.detail || "Could not save preferences.");
      }
      const saved = body.preferences?.retention_days ?? days;
      setRetention(saved);
      setRetentionNever(saved <= 0);
      toast(
        saved <= 0
          ? "Auto-delete off."
          : `Auto-delete unpinned Uploads/Generated after ${saved} days.`,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed.", true);
    }
  }

  function exportCsv() {
    const year = new Date().getFullYear();
    window.open(`/settings/spend/export.csv?year=${year}`, "_blank");
  }

  if (!open) return null;

  const keys = settings?.keys;
  const dash = settings?.dashboards ?? {};
  const paths = settings?.paths;
  const month = spend?.this_month;

  return (
    <aside className="settings">
      <header className="library-head">
        <h2>Settings</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
      </header>

      {error ? <p className="hint warn">{error}</p> : null}

      <section className="settings-sec">
        <h3>API keys</h3>
        <p className="hint">
          Stored locally (not committed). Paste a new value to replace. Runware
          is for Frame / Aleph only.
        </p>
        <KeyField
          label="fal"
          mask={keys?.fal?.mask}
          value={falDraft}
          onChange={setFalDraft}
          href={dash.fal}
        />
        <KeyField
          label="xAI"
          mask={keys?.xai?.mask}
          value={xaiDraft}
          onChange={setXaiDraft}
          href={dash.xai}
        />
        <KeyField
          label="Runware"
          mask={keys?.runware?.mask}
          value={runwareDraft}
          onChange={setRunwareDraft}
          href={dash.runware}
        />
        <button
          type="button"
          className="ghost"
          disabled={saving}
          onClick={() => void saveKeys()}
        >
          {saving ? "Saving…" : "Save keys"}
        </button>
      </section>

      <section className="settings-sec">
        <h3>Balances</h3>
        <BalanceLine name="fal" row={balances.fal} />
        <BalanceLine name="xAI" row={balances.xai} />
        <BalanceLine name="Runware" row={balances.runware} />
        <button
          type="button"
          className="ghost"
          disabled={balBusy}
          onClick={() => void loadBalances()}
        >
          {balBusy ? "Refreshing…" : "Refresh"}
        </button>
      </section>

      <section className="settings-sec">
        <h3>Spend</h3>
        <p className="hint">
          This month {month?.month ?? "—"}:{" "}
          <strong>{money(month?.total)}</strong> · {month?.count ?? 0} job(s)
        </p>
        <ul className="settings-list">
          {(month?.by_provider ?? []).map((p) => (
            <li key={p.provider}>
              {p.provider}: {money(p.total)} ({p.count})
            </li>
          ))}
        </ul>
        <table className="settings-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Total</th>
              <th>Jobs</th>
            </tr>
          </thead>
          <tbody>
            {(spend?.months ?? []).slice(0, 12).map((m) => (
              <tr key={m.month}>
                <td>{m.month}</td>
                <td>{money(m.total)}</td>
                <td>{m.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="ghost" onClick={exportCsv}>
          Annual CSV
        </button>
      </section>

      <section className="settings-sec">
        <h3>Paths</h3>
        <PathRow
          label="Outputs"
          value={paths?.outputs}
          onOpen={() => void openPath("outputs")}
        />
        <PathRow
          label="Resolve inbox"
          value={paths?.resolve_inbox || paths?.resolve_inbox_note || "—"}
          onOpen={
            paths?.resolve_inbox
              ? () => void openPath("resolve_inbox")
              : undefined
          }
        />
        <PathRow
          label="Resolve outbox"
          value={paths?.resolve_outbox}
          onOpen={() => void openPath("resolve_outbox")}
        />
      </section>

      <section className="settings-sec">
        <h3>Preferences</h3>
        <p className="hint">Day theme only. Retention applies to unpinned Uploads and Generated.</p>
        <label className="settings-field">
          <span>Auto-delete after (days)</span>
          <input
            className="model"
            type="number"
            min={0}
            step={1}
            disabled={retentionNever}
            value={retentionNever ? 0 : retention}
            onChange={(e) => setRetention(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label className="param check">
          <input
            type="checkbox"
            checked={retentionNever}
            onChange={(e) => setRetentionNever(e.target.checked)}
          />
          Never
        </label>
        <button
          type="button"
          className="ghost"
          onClick={() => void saveRetention()}
        >
          Save retention
        </button>
      </section>
    </aside>
  );
}

function KeyField({
  label,
  mask,
  value,
  onChange,
  href,
}: {
  label: string;
  mask?: string;
  value: string;
  onChange: (v: string) => void;
  href?: string;
}) {
  return (
    <label className="settings-field">
      <span>
        {label}
        {href ? (
          <>
            {" "}
            <a href={href} target="_blank" rel="noreferrer">
              dashboard
            </a>
          </>
        ) : null}
      </span>
      <input
        className="model"
        type="password"
        autoComplete="off"
        placeholder={mask || "(not set)"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function BalanceLine({ name, row }: { name: string; row?: BalanceRow }) {
  return (
    <p className={row?.ok === false ? "hint warn" : "hint"} title={row?.detail}>
      {row?.label || `${name} · —`}
      {row?.billing_url ? (
        <>
          {" "}
          <a href={row.billing_url} target="_blank" rel="noreferrer">
            billing
          </a>
        </>
      ) : null}
    </p>
  );
}

function PathRow({
  label,
  value,
  onOpen,
}: {
  label: string;
  value?: string | null;
  onOpen?: () => void;
}) {
  return (
    <div className="settings-path">
      <p className="hint" title={value || ""}>
        <strong>{label}</strong>
        <br />
        {value || "—"}
      </p>
      {onOpen ? (
        <button type="button" className="ghost" onClick={onOpen}>
          Open folder
        </button>
      ) : null}
    </div>
  );
}
