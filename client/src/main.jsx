import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { ClubDataProvider } from "./context/ClubDataContext";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClubDataProvider>
          <App />
        </ClubDataProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
