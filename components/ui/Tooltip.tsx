"use client";

import React, { cloneElement, useId } from "react";
import type { ReactElement, ReactNode } from "react";

interface TooltipProps {
  children: ReactElement<{ "aria-describedby"?: string }>;
  content: ReactNode;
  placement?: "top" | "bottom";
}

export function Tooltip({ children, content, placement = "top" }: TooltipProps) {
  const id = useId();
  const trigger = children.props["aria-describedby"] ? children : cloneElement(children, {
    "aria-describedby": id
  });

  return React.createElement(
    "div",
    { className: `tooltip-wrap tooltip-${placement}` },
    trigger,
    React.createElement("div", { className: "tooltip-bubble", role: "tooltip", id }, content)
  );
}
