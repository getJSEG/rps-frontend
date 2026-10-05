"use client";

import isPropValid from "@emotion/is-prop-valid";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiPenTool } from "react-icons/fi";
import type { getCurrentImgDataFunction } from "react-filerobot-image-editor";
import { StyleSheetManager } from "styled-components";
import { canvasToBlob, dataUrlToBlob } from "./designCanvas";

// Konva touches `window` on import, so the editor must only load in the browser.
const FilerobotImageEditor = dynamic(() => import("react-filerobot-image-editor"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-gray-500">Loading editor…</p>,
});

/**
 * Filerobot is written for styled-components v5, which dropped non-HTML props before they reached the DOM.
 * v6 forwards everything, so React warns about props like `showBackButton`; restore the v5 filtering here.
 */
function shouldForwardProp(propName: string, target: unknown) {
  return typeof target === "string" ? isPropValid(propName) : true;
}

/** Every Filerobot tab except Watermark. Crop stays locked to the job shape via `cropRatio`. */
const TABS = ["Adjust", "Finetune", "Filters", "Annotate", "Resize"] as const;

export type DesignEditorExport = { file: Blob; designState: Record<string, unknown> };

/** Legend for the guide lines drawn on product templates. */
const GUIDE_CAPSULES = [
  {
    label: "Safety Area",
    capsuleClass: "border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50",
    // Swatch mirrors the guide line on the template: green dashed.
    swatchClass: "border-t-2 border-dashed border-emerald-500",
    titleClass: "text-emerald-700",
    info: "Keep important text and logos inside the green dashed line. Anything outside it may be trimmed or hidden by the hardware.",
  },
  {
    label: "Bleed",
    capsuleClass: "border-red-200 bg-red-50/60 text-red-600 hover:border-red-300 hover:bg-red-50",
    // Red solid line on the template.
    swatchClass: "border-t-2 border-solid border-red-500",
    titleClass: "text-red-700",
    info: "Extend background colours and images out to the red line. This extra area is trimmed off so your print has no white edges.",
  },
] as const;

function GuideCapsule({ label, capsuleClass, swatchClass, titleClass, info }: (typeof GUIDE_CAPSULES)[number]) {
  return (
    <span
      tabIndex={0}
      aria-label={`${label}: ${info}`}
      className={`group relative inline-flex h-8 cursor-help select-none items-center gap-2 rounded-full border px-3 text-xs shadow-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${capsuleClass}`}
    >
      <span aria-hidden className={`w-4 ${swatchClass}`} />
      {label}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-[300] mt-2.5 w-60 translate-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left text-xs font-normal leading-relaxed text-gray-600 opacity-0 shadow-lg ring-1 ring-black/5 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus:visible group-focus:translate-y-0 group-focus:opacity-100"
      >
        {/* Arrow pointing up at the capsule; borders on two sides continue the box outline */}
        <span
          aria-hidden
          className="absolute -top-[5px] right-5 h-2 w-2 rotate-45 border-l border-t border-gray-200 bg-white"
        />
        <span className={`mb-0.5 block font-semibold ${titleClass}`}>{label}</span>
        {info}
      </span>
    </span>
  );
}

type Props = {
  /** Template URL, blank-canvas data URL, or an object URL of the customer's uploaded image. */
  source: string;
  /** Pixel size of `source`; used to scale default text so it is readable on large canvases. */
  sourceSize: { width: number; height: number } | null;
  /** Open on the crop tool: a freshly uploaded image usually has to be fitted to the job shape first. */
  startOnCrop?: boolean;
  /** Width ÷ height the crop is locked to, when the print shape is known. */
  cropRatio?: number | null;
  jobLabel: string;
  initialDesignState?: Record<string, unknown> | null;
  onBack: () => void;
  onExport: (result: DesignEditorExport) => Promise<void>;
};

export default function DesignEditor({
  source,
  sourceSize,
  startOnCrop = false,
  cropRatio = null,
  jobLabel,
  initialDesignState,
  onBack,
  onExport,
}: Props) {
  const getImgDataRef = useRef<getCurrentImgDataFunction | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shortSide = sourceSize ? Math.min(sourceSize.width, sourceSize.height) : 1000;
  const defaultFontSize = Math.max(24, Math.round(shortSide * 0.06));

  const handleNext = async () => {
    const getImgData = getImgDataRef.current;
    if (!getImgData) return;
    setSaving(true);
    setError(null);
    try {
      // Pixel ratio 1: export at the source's own size (template PNG or blank canvas).
      const { imageData, designState } = getImgData({ name: "design", extension: "png" }, 1);
      const file = imageData.imageCanvas
        ? await canvasToBlob(imageData.imageCanvas)
        : await dataUrlToBlob(String(imageData.imageBase64 || ""));
      // Filerobot loads `imgSrc` from a saved state in place of `source`. It is a blob URL for uploads that is
      // revoked once saved, so it is dropped here and replaced with the current source when the state is reloaded.
      const savedState: Record<string, unknown> = { ...(designState as unknown as Record<string, unknown>) };
      delete savedState.imgSrc;
      await onExport({ file, designState: savedState });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the design.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50"
          >
            <FiArrowLeft size={16} aria-hidden />
            Back
          </button>
          <span className="hidden h-6 w-px bg-gray-200 sm:block" aria-hidden />
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 sm:flex">
            <FiPenTool size={16} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{jobLabel}</p>
            <p className="text-xs text-gray-500">Design editor</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <div className="flex items-center gap-2">
            {GUIDE_CAPSULES.map((capsule) => (
              <GuideCapsule key={capsule.label} {...capsule} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => void handleNext()}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save & Next"}
            {saving ? null : <FiArrowRight size={16} aria-hidden />}
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <StyleSheetManager shouldForwardProp={shouldForwardProp}>
          <FilerobotImageEditor
            source={source}
            tabsIds={[...TABS]}
            defaultTabId={startOnCrop ? "Adjust" : "Annotate"}
            defaultToolId={startOnCrop ? "Crop" : "Text"}
            Crop={cropRatio != null ? { ratio: cropRatio, noPresets: true } : undefined}
            annotationsCommon={{ fill: "#000000" }}
            Text={{ text: "Your text", fontSize: defaultFontSize }}
            Image={{ disableUpload: false, gallery: [] }}
            loadableDesignState={(initialDesignState ? { ...initialDesignState, imgSrc: source } : undefined) as never}
            getCurrentImgDataFnRef={getImgDataRef}
            removeSaveButton
            avoidChangesNotSavedAlertOnLeave
            savingPixelRatio={1}
            previewPixelRatio={typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1}
            observePluginContainerSize
            noCrossOrigin={source.startsWith("data:") || source.startsWith("blob:")}
          />
        </StyleSheetManager>
      </div>
    </div>
  );
}
