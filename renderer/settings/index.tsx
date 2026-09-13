import React from "react";
import ReactDOM from "react-dom/client";
import { initLogging } from "../lib/utils";
import { SettingsView } from "./settings-view";
import "../styles.css";

initLogging();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <SettingsView />
  </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.accept();
}
