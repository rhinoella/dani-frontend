import React from "react";

interface AlertProps {
  variant?: "error" | "info" | "warning";
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}

export function Alert({
  variant = "error",
  title,
  children,
  className = "",
  action,
}: AlertProps) {
  const bgStyles =
    variant === "error"
      ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900"
      : variant === "warning"
      ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900"
      : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900";

  const textStyles =
    variant === "error"
      ? "text-red-800 dark:text-red-200"
      : variant === "warning"
      ? "text-yellow-800 dark:text-yellow-200"
      : "text-blue-800 dark:text-blue-200";

  return (
    <div
      className={`p-4 rounded-lg border ${bgStyles} ${className}`}
      role="alert"
    >
      <div className="flex items-start">
        {variant === "error" && (
          <div className="flex-shrink-0">
            <svg
              className={`w-5 h-5 ${textStyles}`}
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
        <div className={`ml-3 w-full`}>
          {title && (
            <h3 className={`text-sm font-medium ${textStyles}`}>{title}</h3>
          )}
          <div className={`text-sm ${title ? "mt-2" : ""} ${textStyles}`}>
            {children}
          </div>
          {action && <div className="mt-4">{action}</div>}
        </div>
      </div>
    </div>
  );
}
