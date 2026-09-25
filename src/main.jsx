import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import "./styles/auth.css";
import "./styles/dashboard.css";
import "./styles/add-promoter.css";
import "./styles/incident-detail.css";
import "./styles/incident-detail-redesign.css";
import "./styles/incident-history-redesign.css";

const queryClient = new QueryClient();

console.log("Promolocation app started");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
