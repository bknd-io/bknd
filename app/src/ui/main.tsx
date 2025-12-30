import * as React from "react";
import * as ReactDOM from "react-dom/client";
import Admin from "./Admin";
//import "./main.css";
import "./styles.css";

function render() {
   ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
         <Admin withProvider />
      </React.StrictMode>,
   );
}

if ("startViewTransition" in document) {
   document.startViewTransition(render);
} else {
   render();
}

// REGISTER ERROR OVERLAY
const showOverlay = true;
if (process.env.NODE_ENV !== "production" && showOverlay) {
   const showErrorOverlay = (err) => {
      // must be within function call because that's when the element is defined for sure.
      const ErrorOverlay = customElements.get("vite-error-overlay");
      // don't open outside vite environment
      if (!ErrorOverlay) {
         return;
      }
      //console.log("error", err);
      const overlay = new ErrorOverlay(err);
      document.body.appendChild(overlay);
   };

   window.addEventListener("error", ({ error }) => showErrorOverlay(error));
   window.addEventListener("unhandledrejection", ({ reason }) => showErrorOverlay(reason));
}
