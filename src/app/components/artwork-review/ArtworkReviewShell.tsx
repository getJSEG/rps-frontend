import type { ReactNode } from "react";

export type ArtworkReviewJobMeta = {
  jobIdLabel: string;
  orderedAtLabel: string;
  jobName: string;
  product: string;
  dimensions: string;
  quantity: number;
};

type ArtworkReviewShellProps = {
  meta: ArtworkReviewJobMeta;
  children: ReactNode;
};

export default function ArtworkReviewShell({ meta, children }: ArtworkReviewShellProps) {
  return (
    <div className="min-h-screen bg-[#f0f0f0] pb-16 pt-24">
      <div className="mx-auto w-3/4 max-w-full px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            Job ID <span className="font-semibold text-gray-900">{meta.jobIdLabel}</span>
          </span>
          <span className="text-gray-500">{meta.orderedAtLabel}</span>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="grid min-h-[min(70vh,560px)] gap-0 lg:grid-cols-[minmax(200px,26%)_1fr]">
            <aside className="border-gray-200 px-5 py-6 lg:border-r">
              <p className="text-sm text-gray-800">
                <span className="font-medium text-gray-600">Job Name: </span>
                <span className="font-semibold text-gray-900">{meta.jobName}</span>
              </p>
              <div className="my-4 border-t border-gray-200" />
              <p className="text-base font-bold text-gray-900">{meta.product}</p>
              <p className="mt-2 text-sm text-gray-700">{meta.dimensions}</p>
              <p className="mt-2 text-sm text-gray-800">
                <span className="font-medium text-gray-600">Qty: </span>x{meta.quantity}
              </p>
            </aside>
            <div className="border-t border-gray-200 p-5 lg:border-t-0 lg:p-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
