"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { Icon } from "./icons";
import { Button } from "./ui";

export function ReportIssue({ onReported }: { onReported?: () => void }) {
  const [equipment, setEquipment] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function report() {
    setSaving(true);
    setMessage(null);
    try {
      await api("/api/supervisor/equipment-issues", { equipment, description });
      setMessage({ ok: true, text: `${equipment} reported. The supervisor can see it now.` });
      setEquipment("");
      setDescription("");
      onReported?.();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const field = "h-14 w-full rounded-control border border-line-strong bg-surface px-4";
  return (
    <div data-testid="report-issue">
      <p className="text-sm text-soft">Tag the equipment out of service first, then report it here.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[14rem_1fr]">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-soft">Equipment</span>
          <input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Forklift F01" className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-soft">What is wrong</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brakes feel soft" className={field} />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button variant="primary" icon="check" onClick={report} disabled={saving || !equipment.trim() || !description.trim()}>
          Report issue
        </Button>
        {message ? (
          <span role={message.ok ? "status" : "alert"} className={`flex items-center gap-2 font-medium ${message.ok ? "text-ok" : "text-bad"}`}>
            <Icon name={message.ok ? "check" : "alert"} size={20} />
            {message.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
