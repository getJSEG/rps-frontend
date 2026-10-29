"use client";

import Image from "next/image";
import { FiCalendar } from "react-icons/fi";
import InfoPageLayout from "../components/InfoPageLayout";
import { useSiteContent } from "../components/useSiteContent";
import { getProductImageUrl } from "../../utils/api";

export default function HolidaySchedulePage() {
  const site = useSiteContent();
  const imageUrl = site.holidayScheduleImageUrl ? getProductImageUrl(site.holidayScheduleImageUrl) : "";

  return (
    <InfoPageLayout title="Holiday Schedule" width="full">
      {imageUrl ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:p-3">
          {/* Admin-uploaded image of any size; shown as-is so its text stays readable. */}
          <Image
            src={imageUrl}
            alt="Holiday schedule"
            width={1600}
            height={1200}
            unoptimized
            priority
            className="mx-auto h-auto w-auto max-w-full rounded"
          />
        </div>
      ) : site.loaded ? (
        <div className="mx-auto flex max-w-md flex-col items-center rounded-lg border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
          <FiCalendar size={32} className="text-[#f47b23]" aria-hidden />
          <p className="mt-4 text-base font-medium text-gray-900">Holiday schedule coming soon</p>
          <p className="mt-1 text-sm text-gray-500">Please check back closer to the holidays.</p>
        </div>
      ) : null}
    </InfoPageLayout>
  );
}
