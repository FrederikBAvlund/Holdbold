"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type LoadingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
  idleContent: ReactNode;
  loadingContent?: ReactNode;
};

export default function LoadingButton({
  isLoading = false,
  idleContent,
  loadingContent,
  disabled,
  ...props
}: LoadingButtonProps) {
  return (
    <button {...props} disabled={Boolean(disabled) || isLoading}>
      {isLoading ? (loadingContent ?? idleContent) : idleContent}
    </button>
  );
}

