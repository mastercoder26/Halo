import React from "react";
import ReactDOM from "react-dom/client";
import { initLogging } from "../lib/utils";
import { DockView } from "./dock-view";
import "../styles.css";

initLogging();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <DockView />
  </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.accept();
}
