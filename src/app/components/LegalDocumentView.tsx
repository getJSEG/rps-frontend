"use client";

import type { ReactNode } from "react";
import type { LegalBlock, LegalDocument } from "../../content/legal/types";
import InfoPageLayout from "./InfoPageLayout";
import { phoneHref, useSiteContent } from "./useSiteContent";

type ContactValues = { email: string; phone: string; address: string };

const LIST_STYLE: Record<string, string> = {
  lowerLetter: "list-[lower-alpha]",
  upperLetter: "list-[upper-alpha]",
  lowerRoman: "list-[lower-roman]",
  upperRoman: "list-[upper-roman]",
  decimal: "list-decimal",
};

/** Render one line, turning {{email}} / {{phone}} / {{address}} into contact details. Null drops the line. */
function renderLine(line: string, contact: ContactValues, key: string): ReactNode | null {
  const parts = line.split(/(\{\{(?:email|phone|address)\}\})/);
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const token = part.match(/^\{\{(email|phone|address)\}\}$/)?.[1] as keyof ContactValues | undefined;
    if (!token) {
      if (part) out.push(part);
      continue;
    }
    const value = contact[token].trim();
    if (!value) return null;
    if (token === "email") {
      out.push(
        <a key={`${key}-${i}`} href={`mailto:${value}`} className="text-[#0B6BCB] hover:underline">
          {value}
        </a>
      );
    } else if (token === "phone") {
      out.push(
        <a key={`${key}-${i}`} href={phoneHref(value)} className="text-[#0B6BCB] hover:underline">
          {value}
        </a>
      );
    } else {
      out.push(value);
    }
  }
  return out;
}

/** Multi-line text: each line on its own row; lines whose contact value is empty are left out. */
function renderText(text: string, contact: ContactValues, key: string): ReactNode | null {
  const lines = text
    .split("\n")
    .map((line, i) => renderLine(line, contact, `${key}-${i}`))
    .filter((line): line is ReactNode => line !== null);
  if (lines.length === 0) return null;
  // A single line stays inline so it can follow a bold lead-in on the same line.
  if (lines.length === 1) return lines[0];
  return lines.map((line, i) => (
    <span key={`${key}-l${i}`} className="block">
      {line}
    </span>
  ));
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** "HOW WE USE PERSONAL INFORMATION" -> "How We Use Personal Information"; mixed-case headings are left alone. */
function readableHeading(text: string): string {
  if (text !== text.toUpperCase()) return text;
  return text
    .toLowerCase()
    .split(" ")
    .map((word, i) => {
      if (/^[a-z]\.[a-z]\.?$/i.test(word)) return word.toUpperCase(); // U.S.
      if (i > 0 && SMALL_WORDS.has(word)) return word;
      // Capitalize each part of a hyphenated word: "third-party" -> "Third-Party".
      return word.replace(/(^|-)([^a-z-]*)([a-z])/g, (_, sep: string, pre: string, ch: string) => sep + pre + ch.toUpperCase());
    })
    .join(" ");
}

/** The Word lead-in is bold without its period ("Communications" + ". Information..."); keep them together. */
function splitLead(item: { lead?: string; text: string }): { lead: string; text: string } {
  const lead = item.lead ?? "";
  const punctuation = item.text.match(/^[.:;,]/)?.[0];
  if (lead && punctuation) return { lead: lead + punctuation, text: item.text.slice(1).trim() };
  return { lead, text: item.text };
}

const DATE_LINE = /^(effective date|last updated)\s*:/i;

type Group = { kind: "block"; block: LegalBlock } | { kind: "list"; style: string; items: LegalBlock[] };

/** Consecutive list items become one <ol>/<ul>. */
function groupBlocks(blocks: LegalBlock[]): Group[] {
  const groups: Group[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "item") {
      if (last?.kind === "list" && last.style === block.style) last.items.push(block);
      else groups.push({ kind: "list", style: block.style, items: [block] });
    } else {
      groups.push({ kind: "block", block });
    }
  }
  return groups;
}

export default function LegalDocumentView({ document }: { document: LegalDocument }) {
  const site = useSiteContent();
  const contact: ContactValues = {
    email: site.contactEmail,
    phone: site.contactPhone,
    address: site.contactAddress,
  };

  const groups = groupBlocks(document.blocks);
  const firstHeading = groups.findIndex((g) => g.kind === "block" && g.block.type === "heading");

  return (
    <InfoPageLayout title={document.title} width="full">
      <article className="rounded-lg border border-gray-200 bg-white px-5 py-8 text-[15px] leading-7 text-gray-700 shadow-sm sm:px-10 sm:py-10 lg:px-14 lg:py-12">
        {groups.map((group, gi) => {
          if (group.kind === "list") {
            const ordered = group.style !== "bullet";
            const ListTag = ordered ? "ol" : "ul";
            return (
              <ListTag
                key={gi}
                className={`mb-5 ml-5 space-y-3 marker:font-medium marker:text-gray-400 ${
                  ordered ? LIST_STYLE[group.style] ?? "list-decimal" : "list-disc"
                }`}
              >
                {group.items.map((item, ii) => {
                  if (item.type !== "item") return null;
                  const { lead, text } = splitLead(item);
                  const body = renderText(text, contact, `${gi}-${ii}`);
                  if (body === null && !lead) return null;
                  return (
                    <li key={ii} className="pl-2">
                      {lead ? <strong className="font-semibold text-gray-900">{lead} </strong> : null}
                      {body}
                    </li>
                  );
                })}
              </ListTag>
            );
          }
          const { block } = group;
          if (block.type === "heading") {
            return (
              <h2
                key={gi}
                id={`section-${block.number}`}
                className={`mb-4 flex scroll-mt-24 items-start gap-3 text-lg font-semibold leading-snug text-gray-900 sm:text-xl ${
                  gi === firstHeading ? "mt-8" : "mt-10 border-t border-gray-100 pt-8"
                }`}
              >
                <span className="mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[#f47b23]/10 px-2 text-sm font-semibold text-[#d96a18]">
                  {block.number}
                </span>
                <span>{readableHeading(block.text)}</span>
              </h2>
            );
          }
          if (DATE_LINE.test(block.text)) {
            return (
              <p key={gi} className="mb-6">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                  {block.text}
                </span>
              </p>
            );
          }
          const body = renderText(block.text, contact, String(gi));
          if (body === null) return null;
          if (block.text.includes("\n")) {
            // Contact / address blocks: several short lines grouped in a soft box.
            return (
              <div key={gi} className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-gray-800">
                {body}
              </div>
            );
          }
          const intro = firstHeading === -1 || gi < firstHeading;
          return (
            <p key={gi} className={intro ? "mb-5 text-base leading-7 text-gray-800" : "mb-4"}>
              {body}
            </p>
          );
        })}
      </article>
    </InfoPageLayout>
  );
}
