"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * PasswordInput — a drop-in replacement for <Input type="password"> that adds a
 * show/hide toggle. The eye button flips the field between `password` and `text`
 * so the user can confirm what they typed (passwords, shared-secret answers).
 *
 * It forwards all native input props (and `ref`) to the underlying Input, so it
 * behaves exactly like <Input> at every call site — just pass the same props and
 * omit `type` (it's managed internally).
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        // Reserve room on the right so typed text never runs under the icon.
        className={cn("pr-9", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // The field itself stays first in tab order; the toggle follows it.
        tabIndex={0}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        disabled={props.disabled}
        className={cn(
          "absolute inset-y-0 right-0 flex w-9 items-center justify-center",
          "text-muted-foreground transition-colors hover:text-foreground",
          "focus-visible:outline-none focus-visible:text-foreground",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
