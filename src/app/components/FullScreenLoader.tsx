"use client";

export default function FullScreenLoader({
  message = "Loading………",
}: {
  message?: string;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-slate-100 text-slate-700">
      <div
        className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-800"
        role="status"
        aria-label={message}
      />
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
