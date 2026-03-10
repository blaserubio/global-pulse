"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Check, AlertCircle } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error";

interface RefreshButtonProps {
  onRefresh: () => Promise<number>; // returns count of new items
  lastUpdated: Date | null;
}

export function RefreshButton({ onRefresh, lastUpdated }: RefreshButtonProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [newCount, setNewCount] = useState(0);
  const [showBadge, setShowBadge] = useState(false);
  const [relativeTime, setRelativeTime] = useState("");

  // Update relative time every 15s
  useEffect(() => {
    function update() {
      if (!lastUpdated) { setRelativeTime(""); return; }
      const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      if (seconds < 10) setRelativeTime("just now");
      else if (seconds < 60) setRelativeTime(`${seconds}s ago`);
      else if (seconds < 3600) setRelativeTime(`${Math.floor(seconds / 60)}m ago`);
      else setRelativeTime(`${Math.floor(seconds / 3600)}h ago`);
    }
    update();
    const interval = setInterval(update, 15000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleRefresh = useCallback(async () => {
    if (status === "loading") return;
    setStatus("loading");
    setShowBadge(false);
    try {
      const count = await onRefresh();
      setNewCount(count);
      setStatus("success");
      if (count > 0) {
        setShowBadge(true);
        setTimeout(() => setShowBadge(false), 5000);
      }
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [onRefresh, status]);

  // Keyboard shortcut: Shift+R
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.shiftKey && e.key === "R" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        handleRefresh();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleRefresh]);

  const isSuccess = status === "success";
  const isError = status === "error";
  const isLoading = status === "loading";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Last updated label */}
      {relativeTime && (
        <span className="text-xs text-muted bg-surface/90 backdrop-blur-sm border border-border rounded-full px-3 py-1">
          Updated {relativeTime}
        </span>
      )}

      {/* Success/error toast */}
      {isSuccess && newCount === 0 && (
        <span className="text-xs text-emerald-400 bg-surface/90 backdrop-blur-sm border border-emerald-500/30 rounded-full px-3 py-1 animate-fade-in">
          You&apos;re all caught up
        </span>
      )}
      {isError && (
        <span className="text-xs text-red-400 bg-surface/90 backdrop-blur-sm border border-red-500/30 rounded-full px-3 py-1 animate-fade-in">
          Update failed — tap to retry
        </span>
      )}

      {/* FAB */}
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        title="Refresh stories (Shift+R)"
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 disabled:hover:scale-100 ${
          isSuccess
            ? "bg-emerald-500 shadow-emerald-500/25"
            : isError
            ? "bg-red-500 shadow-red-500/25"
            : "bg-gradient-to-br from-[#e94560] to-[#c0392b] shadow-[#e94560]/25"
        }`}
        style={{ boxShadow: isLoading ? "0 0 20px rgba(233,69,96,0.4)" : undefined }}
      >
        {isSuccess ? (
          <Check className="w-6 h-6 text-white" />
        ) : isError ? (
          <AlertCircle className="w-6 h-6 text-white" />
        ) : (
          <RefreshCw className={`w-6 h-6 text-white ${isLoading ? "animate-spin" : ""}`} />
        )}

        {/* New count badge */}
        {showBadge && newCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs font-bold rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1 animate-bounce">
            +{newCount}
          </span>
        )}
      </button>
    </div>
  );
}
