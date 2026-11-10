import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/literata/opsz.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
