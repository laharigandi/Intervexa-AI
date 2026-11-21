import React from "react";
import theme from "../styles/theme";

function PageActions({ children, sticky = false, style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        marginTop: 24,
        paddingTop: 18,
        borderTop: `1px solid ${theme.border}`,
        ...(sticky
          ? {
              position: "sticky",
              bottom: 0,
              background: "#ffffff",
              padding: "16px 20px",
              boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.05)",
              zIndex: 20,
              borderRadius: theme.radius.sm,
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default PageActions;
