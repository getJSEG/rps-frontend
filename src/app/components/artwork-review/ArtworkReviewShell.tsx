import type { ReactNode } from "react";
import type { StoredPendingJobLine } from "./uploadApprovalReviewStorage";

/** Header display: hide line index suffix (-01, -02, …) appended in UploadApproval. */
function jobIdLabelForDisplay(jobIdLabel: string): string {
  const t = jobIdLabel.trim();
  return t.replace(/-\d+$/, "");
}

export type ArtworkReviewJobMeta = {
  jobIdLabel: string;
  orderedAtLabel: string;
  jobName: string;
  product: string;
  dimensions: string;
  quantity: number;
};

function isActiveSidebarRow(
  row: StoredPendingJobLine,
  activeOrderItemId: number | null | undefined,
  activeJobIdLabel: string | undefined
): boolean {
  if (
    activeOrderItemId != null &&
    row.orderItemId != null &&
    Number.isFinite(activeOrderItemId) &&
    row.orderItemId === activeOrderItemId
  ) {
    return true;
  }
  if (activeJobIdLabel && row.jobIdLabel === activeJobIdLabel) return true;
  return false;
}

type ArtworkReviewShellProps = {
  meta: ArtworkReviewJobMeta;
  children: ReactNode;
  /** When present, left column lists every job on this order still pending upload; active row matches the file under review. */
  sidebarJobs?: StoredPendingJobLine[] | null;
  activeOrderItemId?: number | null;
  activeJobIdLabel?: string;
  /** When set, clicking a job row switches the active line (error review). */
  onSelectJob?: (row: StoredPendingJobLine) => void;
};

export default function ArtworkReviewShell({
  meta,
  children,
  sidebarJobs,
  activeOrderItemId,
  activeJobIdLabel,
  onSelectJob,
}: ArtworkReviewShellProps) {
  const list = sidebarJobs?.length ? sidebarJobs : null;
  const selectable = Boolean(onSelectJob);

  return (
    <div className="min-h-screen bg-[#f0f0f0] pb-16 pt-24">
      <div className="mx-auto w-3/4 max-w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">{jobIdLabelForDisplay(meta.jobIdLabel)}</span>
          <span className="text-gray-500">{meta.orderedAtLabel}</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="grid min-h-[min(70vh,560px)] gap-0 lg:grid-cols-[minmax(200px,26%)_1fr]">
            <aside className="border-gray-200 px-5 py-6 lg:border-r">
              {list ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Jobs — upload artwork
                  </p>
                  <ul className="mt-3 max-h-[min(58vh,480px)] space-y-2 overflow-y-auto pr-1">
                    {list.map((row) => {
                      const active = isActiveSidebarRow(row, activeOrderItemId, activeJobIdLabel);
                      const canSelect = selectable && row.orderItemId != null && row.orderItemId > 0;
                      const rowClass = `w-full rounded-md border px-3 py-2.5 text-left text-sm ${
                        active
                          ? "border-sky-500 bg-sky-50 shadow-sm"
                          : "border-gray-100 bg-gray-50/80 text-gray-800"
                      } ${canSelect ? "cursor-pointer transition-colors hover:border-sky-300 hover:bg-sky-50/50" : ""}`;
                      const inner = (
                        <>
                          <p className="text-gray-800">
                            <span className="font-medium text-gray-500">Job name: </span>
                            {row.jobName}
                          </p>
                          <p className="mt-1 text-gray-800">
                            <span className="font-medium text-gray-500">Product: </span>
                            {row.product}
                          </p>
                          <p className="mt-1 text-sm text-gray-700">{row.dimensions}</p>
                        </>
                      );
                      return (
                        <li key={`${row.orderId}-${row.jobIdLabel}`}>
                          {canSelect ? (
                            <button type="button" className={rowClass} onClick={() => onSelectJob?.(row)}>
                              {inner}
                            </button>
                          ) : (
                            <div className={rowClass}>{inner}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-800">
                    <span className="font-medium text-gray-500">Job name: </span>
                    {meta.jobName}
                  </p>
                  <p className="mt-2 text-sm text-gray-800">
                    <span className="font-medium text-gray-500">Product: </span>
                    {meta.product}
                  </p>
                  <p className="mt-2 text-sm text-gray-700">{meta.dimensions}</p>
                </>
              )}
            </aside>
            <div className="border-t border-gray-200 p-5 lg:border-t-0 lg:p-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
