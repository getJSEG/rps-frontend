/**
 * Demo-only job data until artwork validation is wired to the API.
 */
export const ARTWORK_REVIEW_DEMO = {
  jobIdLabel: "A8399511-01",
  /** Pre-formatted for display */
  orderedAtLabel: "Mar 17 7:09pm",
  jobName: "sample",
  product: "Feather Angled Flag",
  dimensions: `2' 1" × 6' 8" (25" × 80")`,
  quantity: 1,
  requiredInches: { w: 25, h: 80 },
  fileNameOk: "FeatherAngled_S_SingleSided_PrintThru.pdf",
  fileNameError: "SB Logo.jpg",
  uploadedInchesError: { w: 8.5, h: 11 },
} as const;
