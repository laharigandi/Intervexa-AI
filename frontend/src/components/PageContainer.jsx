import React from "react";
import theme from "../styles/theme";

function PageContainer({ children, style = {}, className = "" }) {
  return (
    <main
      className={`page-enter-animation ${className}`}
      style={{
        maxWidth: theme.maxWidth,
        margin: "0 auto",
        padding: "clamp(16px, 2.5vw, 24px) clamp(16px, 2.5vw, 24px)",
        width: "100%",
        boxSizing: "border-box",
        flex: 1,
        minWidth: 0,
        textAlign: "left",
        ...style,
      }}
    >
      {children}
    </main>
  );
}

export default PageContainer;
