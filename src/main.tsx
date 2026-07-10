import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installClipboardFallback } from "./lib/utils/clipboardPatch";

installClipboardFallback();

createRoot(document.getElementById("root")!).render(<App />);
