export function initLogging(): void {
  window.addEventListener("error", (event) => {
    console.error("[renderer]", event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => {
    console.error("[renderer]", event.reason);
  });
}
