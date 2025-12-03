/// <reference types="vite/client" />

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClientProvider } from "bknd/client";
import App from "../src/App.tsx";

createRoot(document.getElementById("root")!).render(
   <StrictMode>
      <ClientProvider>
         <App />
      </ClientProvider>
   </StrictMode>,
);
