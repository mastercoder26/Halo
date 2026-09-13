import { useState } from "react";

import appIcon from "../../app-icon.png";
import { Button } from "../lib/components";

const STEPS = [
  {
    title: "Welcome to Halo",
    description: "Turn the corners and edges of your display into quick macOS controls.",
    detail: "Halo stays in the menu bar and only appears when your cursor reaches a zone you choose.",
  },
  {
    title: "Allow system controls",
    description: "Accessibility access lets Halo change protected controls such as appearance and keyboard backlight.",
    detail: "You can enable or change this later from Halo Settings.",
  },
  {
    title: "Make it yours",
    description: "Halo starts with brightness in the top-left corner and volume in the bottom-left corner.",
    detail: "Open Settings anytime from the menu bar to assign any supported control to a corner or edge.",
  },
] as const;

export function OnboardingView() {
  const [stepIndex, setStepIndex] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const finishSetup = async () => {
    try {
      await window.haloAPI.onboarding.complete();
    } catch {
      setStatus("Couldn’t finish setup. Please try again.");
    }
  };

  const openAccessibilitySettings = async () => {
    try {
      await window.haloAPI.accessibility.openSettings();
      setStatus("Enable Halo in Privacy & Security → Accessibility, then return here.");
    } catch {
      setStatus("Couldn’t open Accessibility settings.");
    }
  };

  return (
    <main className="flex h-screen flex-col bg-[#171719] p-8 text-primary">
      <div className="flex items-center gap-3">
        <img src={appIcon} alt="" className="h-10 w-10 rounded-xl" />
        <div>
          <p className="text-base font-semibold">Halo</p>
          <p className="text-xs text-secondary">First-time setup</p>
        </div>
      </div>

      <section className="flex flex-1 flex-col justify-center">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[var(--theme-accent)]">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{step.title}</h1>
        <p className="mt-4 max-w-md text-base leading-7 text-secondary">{step.description}</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-secondary">{step.detail}</p>
        {stepIndex === 1 ? (
          <Button
            className="mt-6 self-start"
            size="small"
            variant="muted"
            onClick={() => void openAccessibilitySettings()}
          >
            Open Accessibility Settings
          </Button>
        ) : null}
        {status ? <p className="mt-4 max-w-md text-sm text-secondary">{status}</p> : null}
      </section>

      <div className="flex items-center justify-between gap-3">
        <Button
          size="small"
          variant="transparent"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
        >
          Back
        </Button>
        <Button
          size="small"
          variant="accent"
          onClick={() => {
            if (isLastStep) {
              void finishSetup();
              return;
            }
            setStepIndex((current) => Math.min(STEPS.length - 1, current + 1));
          }}
        >
          {isLastStep ? "Finish setup" : "Continue"}
        </Button>
      </div>
    </main>
  );
}
