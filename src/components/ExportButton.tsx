"use client";

import { useState } from "react";
import { useToast } from "@/components/Toast";

interface ExportButtonProps {
  label: string;
  pendingLabel: string;
  onExport: () => Promise<unknown>;
}

export default function ExportButton({
  label,
  pendingLabel,
  onExport,
}: ExportButtonProps) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleClick() {
    if (pending) return;

    setPending(true);
    try {
      await onExport();
    } catch (err) {
      showToast((err as Error).message, "error");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
