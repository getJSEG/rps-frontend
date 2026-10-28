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
  return lines.map((line, i) => (
    <span key={`${key}-l${i}`} className="block">
      {line}
    </span>
  ));
}

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

  return (
    <InfoPageLayout title={document.title} width="text">
      <article className="rounded-lg border border-gray-200 bg-white px-5 py-8 text-[15px] leading-relaxed text-gray-700 shadow-sm sm:px-10 sm:py-10">
        {groupBlocks(document.blocks).map((group, gi) => {
          if (group.kind === "list") {
            const ordered = group.style !== "bullet";
            const ListTag = ordered ? "ol" : "ul";
            return (
              <ListTag
                key={gi}
                className={`mb-4 ml-6 space-y-2 ${ordered ? LIST_STYLE[group.style] ?? "list-decimal" : "list-disc"}`}
              >
                {group.items.map((item, ii) => {
                  if (item.type !== "item") return null;
                  const body = renderText(item.text, contact, `${gi}-${ii}`);
                  if (body === null && !item.lead) return null;
                  return (
                    <li key={ii} className="pl-1">
                      {item.lead ? <strong className="font-semibold text-gray-900">{item.lead} </strong> : null}
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
              <h2 key={gi} className="mb-3 mt-8 text-lg font-semibold text-gray-900 first:mt-0">
                {block.number}. {block.text}
              </h2>
            );
          }
          const body = renderText(block.text, contact, String(gi));
          return body === null ? null : (
            <p key={gi} className="mb-4">
              {body}
            </p>
          );
        })}
      </article>
    </InfoPageLayout>
  );
}
