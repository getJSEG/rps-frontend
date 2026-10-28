"use client";

import { FiClock, FiMail, FiMapPin, FiPhone } from "react-icons/fi";
import InfoPageLayout from "../components/InfoPageLayout";
import { phoneHref, useSiteContent } from "../components/useSiteContent";

export default function ContactUsPage() {
  const site = useSiteContent();

  return (
    <InfoPageLayout title="Contact Us" subtitle="We're here to help with orders, artwork and anything else you need.">
      {site.contactAddress || site.contactHours ? (
        <div className="mb-8 space-y-2 text-center text-sm text-gray-700">
          {site.contactAddress ? (
            <p className="flex items-center justify-center gap-2 whitespace-pre-line">
              <FiMapPin className="shrink-0 text-[#f47b23]" aria-hidden />
              <span>{site.contactAddress}</span>
            </p>
          ) : null}
          {site.contactHours ? (
            <p className="flex items-center justify-center gap-2 text-gray-500">
              <FiClock className="shrink-0 text-[#f47b23]" aria-hidden />
              <span>Customer Service Office Hours: {site.contactHours}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        <section className="flex flex-col items-center rounded-lg border border-gray-200 bg-white px-6 py-8 text-center shadow-sm transition-shadow hover:shadow-md">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#0B6BCB]/10 text-[#0B6BCB]">
            <FiPhone size={22} aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-gray-900">Phone Support</h2>
          <p className="mt-2 text-sm text-gray-600">Toll Free: {site.contactPhone}</p>
          <a
            href={phoneHref(site.contactPhone)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0B6BCB] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <FiPhone aria-hidden />
            Call
          </a>
        </section>

        <section className="flex flex-col items-center rounded-lg border border-gray-200 bg-white px-6 py-8 text-center shadow-sm transition-shadow hover:shadow-md">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f47b23]/10 text-[#d96a18]">
            <FiMail size={22} aria-hidden />
          </span>
          <h2 className="text-lg font-semibold text-gray-900">Email</h2>
          <a href={`mailto:${site.contactEmail}`} className="mt-2 break-all text-sm text-[#0B6BCB] hover:underline">
            {site.contactEmail}
          </a>
          <a
            href={`mailto:${site.contactEmail}`}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md border border-[#0B6BCB] px-4 py-2.5 text-sm font-semibold text-[#0B6BCB] transition-colors hover:bg-[#0B6BCB] hover:text-white"
          >
            <FiMail aria-hidden />
            Send Email
          </a>
        </section>
      </div>
    </InfoPageLayout>
  );
}
