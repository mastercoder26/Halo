import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "../lib/app-icon";

import { HALO_AMBER, HALO_HAIRLINE, HALO_INSET } from "../brand";

interface DockAppInfo {
  path: string;
  name: string;
}

export function DockView() {
  const [apps, setApps] = useState<DockAppInfo[]>([]);
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [launchingPath, setLaunchingPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await window.haloAPI.ipc.invoke<DockAppInfo[]>("halo:getDockApps");
      setApps(list);
      setVisible(true);
    } catch {
      setApps([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const unsub = window.haloAPI.ipc.on("halo:overlay-state", (_event, payload) => {
      const next = payload as { role?: string } | null;
      if (next?.role === "dock") {
        void refresh();
      } else if (!next) {
        setVisible(false);
        setFocused(null);
        setLaunchingPath(null);
        setFeedback(null);
      }
    });
    return unsub;
  }, [refresh]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const launch = async (appPath: string) => {
    if (launchingPath) return;
    setLaunchingPath(appPath);
    setFeedback(null);
    try {
      const result = await window.haloAPI.ipc.invoke<{ ok: boolean; error?: string }>(
        "halo:launchApp",
        appPath,
      );
      if (!result?.ok) setFeedback(result?.error || "Couldn't launch app");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Couldn't launch app");
    } finally {
      setLaunchingPath(null);
    }
  };

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center px-3 ${
        visible ? "halo-dock-in" : "translate-y-2 opacity-0"
      }`}
    >
      <div
        className="halo-dock-strip flex h-[68px] max-w-full items-end gap-1.5 overflow-x-auto rounded-full px-3.5 py-2"
        style={{
          // Light wash so native HUD vibrancy can show through
          background: "rgba(22,22,24,0.28)",
          boxShadow: `0 10px 28px rgba(0,0,0,0.36), ${HALO_INSET}`,
          border: `1px solid ${HALO_HAIRLINE}`,
        }}
      >
        {apps.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: HALO_AMBER }}
              aria-hidden="true"
            />
            <span className="text-xs font-medium text-white/70">Add apps in Halo Settings</span>
          </div>
        ) : (
          apps.map((app) => {
            const isFocused = focused === app.path;
            return (
              <button
                key={app.path}
                type="button"
                title={app.name}
                className={`halo-dock-item no-drag relative flex size-[52px] shrink-0 flex-col items-center justify-end rounded-[16px]${
                  isFocused ? " is-focused" : ""
                }`}
                onMouseEnter={() => setFocused(app.path)}
                onMouseLeave={() => setFocused(null)}
                onClick={() => void launch(app.path)}
                disabled={!visible || launchingPath !== null}
                aria-busy={launchingPath === app.path || undefined}
              >
                <AppIcon
                  appPath={app.path}
                  alt={app.name}
                  size={44}
                  className="size-11 object-contain drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
                />
                <span
                  className="mt-1 h-[3px] rounded-full transition-[width,opacity] duration-150"
                  style={{
                    width: isFocused ? 14 : 0,
                    opacity: isFocused ? 1 : 0,
                    background: HALO_AMBER,
                  }}
                  aria-hidden="true"
                />
              </button>
            );
          })
        )}
      </div>
      {feedback ? (
        <span role="status" className="absolute inset-x-3 bottom-0 truncate text-center text-[10px] font-medium text-red-300">
          {feedback}
        </span>
      ) : null}
    </div>
  );
}
