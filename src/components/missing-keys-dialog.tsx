"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function MissingKeysDialog() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<{
    valyuKeyPresent: boolean;
    daytonaKeyPresent: boolean;
    openaiKeyPresent: boolean;
    aiGatewayKeyPresent: boolean;
    aiGatewayRequired?: boolean;
    isDevelopment?: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch environment status
        const envRes = await fetch("/api/env-status", { cache: "no-store" });
        if (!envRes.ok) throw new Error("Failed to fetch env status");
        const envData = await envRes.json();

        if (!cancelled) {
          setStatus(envData);

          // AI Gateway is required (or recommended in dev mode)
          const missingGateway = !envData.aiGatewayKeyPresent;
          const missing =
            !envData.valyuKeyPresent ||
            !envData.daytonaKeyPresent ||
            missingGateway;

          // Only show dialog if API keys are missing
          if (missing) setOpen(true);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status) return null;

  const missingValyu = !status.valyuKeyPresent;
  const missingDaytona = !status.daytonaKeyPresent;
  const missingGateway = !status.aiGatewayKeyPresent;

  // Don't show if no API key issues
  if (!missingValyu && !missingDaytona && !missingGateway) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Setup Required</DialogTitle>
          <DialogDescription>
            This app requires API keys for full functionality. Some features are disabled until keys are added.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {missingValyu && (
            <div className="rounded-md border p-3">
              <div className="font-medium">Missing VALYU_API_KEY</div>
              <div className="text-muted-foreground">
                Add VALYU_API_KEY to your environment to enable biomedical data and
                web search.
              </div>
            </div>
          )}
          {missingDaytona && (
            <div className="rounded-md border p-3">
              <div className="font-medium">Missing DAYTONA_API_KEY</div>
              <div className="text-muted-foreground">
                Add DAYTONA_API_KEY to run Python code in the secure sandbox.
              </div>
            </div>
          )}
          {missingGateway && (
            <div className="rounded-md border p-3">
              <div className="font-medium">
                Missing AI_GATEWAY_API_KEY {status.aiGatewayRequired ? '(Required)' : '(Recommended)'}
              </div>
              <div className="text-muted-foreground">
                Add AI_GATEWAY_API_KEY to enable Vercel AI Gateway integration.
                Get your key at{" "}
                <a
                  href="https://vercel.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  vercel.com/dashboard
                </a>
                {" "}→ AI Gateway → API Keys
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Dismiss
          </Button>
          <a
            href="https://platform.valyu.ai"
            target="_blank"
            rel="noreferrer"
          >
            <Button>Get Valyu Key</Button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
