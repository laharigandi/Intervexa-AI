import React from "react";
import theme from "../styles/theme";

function PageHeader({ title, subtitle, badge, action, style = {} }) {
  return (
    <header
      style={{
        marginBottom: 14,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 14,
        ...style,
      }}
    >
      <div>
        {badge && (
          <div style={{ marginBottom: 6 }}>
            {badge}
          </div>
        )}
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: theme.text,
            letterSpacing: "-0.03em",
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            style={{
              margin: "6px 0 0 0",
              color: theme.muted,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {action}
        </div>
      )}
    </header>
  );
}

export default PageHeader;
