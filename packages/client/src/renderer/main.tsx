import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { getApiBaseUrl } from "./config.js";
import "./index.css";

// Pre-warm the backend the instant the app opens. The free host sleeps when idle
// and takes ~40s to wake; firing this now lets that happen behind the splash and
// while the user types their credentials, instead of after they tap Sign in.
// The health route also wakes the database. Fire-and-forget.
void fetch(`${getApiBaseUrl()}/api/health`).catch(() => {});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
