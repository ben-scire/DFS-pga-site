import { cn } from "@/lib/utils";

export const Logo = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("h-6 w-6", className)}
  >
    <path d="M12 18V3l7 4-7 4" />
    <path d="M12 18H7.5a4.5 4.5 0 0 1 0-9H12" />
    <circle cx="12" cy="18" r="1.5" />
  </svg>
);
