import React from "react";
import theme from "../styles/theme";

function Layout({ children, style = {}, className = "" }) {
  return (
    <div
      className={`app-layout ${className}`}
      style={{
        minHeight: "100vh",
        height: "100vh",
        width: "100%",
        background: theme.background,
        display: "flex",
        flexDirection: "row",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Layout;
