import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-card group-[.toaster]:text-text-primary group-[.toaster]:border group-[.toaster]:border-surface-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-text-secondary",
          actionButton: "group-[.toast]:bg-brand group-[.toast]:text-brand-foreground",
          cancelButton: "group-[.toast]:bg-surface-border group-[.toast]:text-text-secondary",
          success: "group-[.toaster]:border-success [&_[data-icon]]:text-success",
          error: "group-[.toaster]:border-danger [&_[data-icon]]:text-danger",
          warning: "group-[.toaster]:border-warning [&_[data-icon]]:text-warning",
          info: "group-[.toaster]:border-surface-border [&_[data-icon]]:text-text-secondary",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
