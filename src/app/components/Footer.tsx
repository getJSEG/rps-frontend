"use client";

import Link from "next/link";
import { phoneHref, useSiteContent } from "./useSiteContent";

const NAVIGATION_LINKS = [
  { label: "About Us", href: "/about-us" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "Help Center", href: "/help-center" },
  { label: "Holiday Schedule", href: "/holiday-schedule" },
];

const POLICY_LINKS = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

export default function Footer() {
  const site = useSiteContent();

  return (
    <footer className="relative w-full min-w-0 bg-[#3f3f3f] text-white">
      {/* Full-width accent */}
      <div
        className="h-1 w-full bg-gradient-to-r from-[#d96a18] via-[#f47b23] to-[#d96a18]"
        aria-hidden
      />

      {/* Main band — edge-to-edge with responsive gutters */}
      <div className="relative w-full border-b border-white/5 bg-gradient-to-b from-[#434343] to-[#3a3a3a]">
        <div className="w-full px-6 py-6 sm:px-10 sm:py-7 md:px-12 md:py-8 lg:px-16 xl:px-20 2xl:px-24">
          <div className="mx-auto grid w-full max-w-none grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:gap-12 xl:gap-16 md:items-start">
            <section className="flex min-w-0 flex-col">
              <h3 className="mb-3 border-b border-[#f47b23]/35 pb-2 text-base font-semibold tracking-wide text-white">
                Contact
              </h3>
              <div className="flex flex-col gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-100 sm:text-sm">
                    Customer Service Office Hour
                  </p>
                  <p className="text-xs leading-snug text-gray-300 sm:text-sm">
                    {site.contactHours}
                  </p>
                </div>

                <div className="space-y-2.5 border-t border-dashed border-gray-500/50 pt-3">
                  <p className="text-xs font-medium text-gray-100 sm:text-sm">
                    Toll Free:{" "}
                    <span className="font-normal text-gray-200">
                      {site.contactPhone}
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={phoneHref(site.contactPhone)}
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#0B6BCB] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition-colors hover:bg-blue-600 sm:text-sm"
                    >
                      <svg
                        className="h-3.5 w-3.5 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      Call
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex min-w-0 flex-col">
              <h3 className="mb-3 border-b border-[#f47b23]/35 pb-2 text-base font-semibold tracking-wide text-white">
                Product Catalog
              </h3>
              <button
                type="button"
                className="inline-flex w-full max-w-xs items-center justify-center rounded-md border border-gray-400/70 bg-[#4a4a4a] px-4 py-1.5 text-xs font-medium text-gray-100 shadow-sm transition-colors hover:bg-[#555] sm:w-auto sm:min-w-[160px] sm:text-sm"
              >
                Download PDF
              </button>
            </section>

            <section className="flex min-w-0 flex-col">
              <h3 className="mb-3 border-b border-[#f47b23]/35 pb-2 text-base font-semibold tracking-wide text-white">
                Email
              </h3>
              <a
                href={`mailto:${site.contactEmail}`}
                className="break-all text-xs leading-snug text-gray-200 underline-offset-2 transition-colors hover:text-white hover:underline sm:text-sm"
              >
                {site.contactEmail}
              </a>
            </section>
          </div>

          <nav
            className="mx-auto mt-6 w-full max-w-none border-t border-dashed border-gray-500/45 pt-5 md:mt-7 md:pt-6"
            aria-label="Footer links"
          >
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7 md:gap-x-9">
              {NAVIGATION_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-xs text-gray-300 transition-colors hover:text-[#f47b23] sm:text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      {/* Full-width bottom bar */}
      <div className="w-full border-t border-gray-600/80 bg-[#1e1e1e]">
        <div className="w-full px-6 py-2 sm:px-10 md:px-12 lg:px-16 xl:px-20 2xl:px-24">
          <div className="flex w-full flex-col items-center justify-center gap-1.5 text-center sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-0">
            <p className="text-[11px] leading-snug text-gray-500 sm:text-xs">
              Copyright © 2026-2027 Resourceful Print Solutions, Inc. All Rights
              Reserved.
            </p>
            {POLICY_LINKS.map((link) => (
              <span key={link.href} className="flex items-center gap-x-5">
                <span
                  className="hidden h-3 w-px shrink-0 bg-gray-600 sm:block"
                  aria-hidden
                />
                <Link
                  href={link.href}
                  className="text-[11px] text-blue-400/90 transition-colors hover:text-blue-300 sm:text-xs"
                >
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
