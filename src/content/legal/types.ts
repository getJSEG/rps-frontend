/**
 * Policy pages (Terms, Privacy, Cookie) as structured blocks, converted from the client's Word documents.
 * `{{email}}`, `{{phone}}` and `{{address}}` mark fill-in blanks from those documents; the page fills them from
 * the admin Contact details and drops a line whose value is empty.
 */
export type LegalBlock =
  | { type: "heading"; number: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "item"; level: number; style: string; text: string; lead?: string };

export type LegalDocument = {
  title: string;
  blocks: LegalBlock[];
};
