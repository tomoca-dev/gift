import { validateEnv } from "./lib/env-validator";
// Validate environment variables immediately
validateEnv();

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
