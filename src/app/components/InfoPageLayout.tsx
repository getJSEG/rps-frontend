"use client";

import type { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

type Props = {
  title: string;
  subtitle?: ReactNode;
  /** "text" is a narrow reading column (policy pages); "wide" fits cards (contact, help center). */
  width?: "text" | "wide";
  children: ReactNode;
};

/** Shared shell for simple content pages: navbar, navy title band, light content area, footer. */
export default function InfoPageLayout({ title, subtitle, width = "wide", children }: Props) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#f3f4f6] pt-[61px]">
        <header className="relative overflow-hidden bg-[#1f2d44] px-4 py-12 text-center sm:py-14">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#d96a18] via-[#f47b23] to-[#d96a18]"
            aria-hidden
          />
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
          {subtitle ? <div className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">{subtitle}</div> : null}
        </header>
        <div
          className={`mx-auto w-full px-4 py-10 sm:px-6 sm:py-12 ${width === "text" ? "max-w-3xl" : "max-w-5xl"}`}
        >
          {children}
        </div>
      </main>
      <Footer />
    </>
  );
}
