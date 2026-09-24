"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiFileText, FiX } from "react-icons/fi";
import {
  designsAPI,
  getBackendBaseUrl,
  getProductImageUrl,
  type DesignUploadFields,
  type ProductDesignTemplate,
} from "../../../utils/api";
import DesignEditor, { type DesignEditorExport } from "./DesignEditor";
import {
  blankCanvasDataUrl,
  isPdfDesign,
  printSizeKey,
  type JobDesign,
  type PrintSize,
} from "./designCanvas";

export type DesignFlowJob = { id: string; jobName: string; quantity: string };

type Step = "choose" | "editor" | "review" | "summary";

type Props = {
  productId: string;
  jobs: DesignFlowJob[];
  startIndex: number;
  templates: ProductDesignTemplate[];
  /** Job print size when the customer enters it; used for the blank canvas and shape checks. */
  printSize: PrintSize | null;
  designs: Record<string, JobDesign>;
  onDesignChange: (jobId: string, design: JobDesign | null) => void;
  onClose: () => void;
  onAddToCart: () => void;
};

const REVIEW_CHECKLIST = [
  "Text is clear and easy to read",
  "Information is spelled correctly",
  "Images are sharp with no blurring",
];

function jobLabel(job: DesignFlowJob, index: number) {
  return job.jobName.trim() || `Artwork ${index + 1}`;
}

function DesignPreview({ design, className }: { design: JobDesign; className?: string }) {
  if (isPdfDesign(design)) {
    return (
      <a
        href={getProductImageUrl(design.fileUrl)}
        target="_blank"
        rel="noreferrer"
        className={`flex flex-col items-center justify-center gap-2 text-sm text-blue-600 underline ${className ?? ""}`}
      >
        <FiFileText size={40} aria-hidden />
        Open PDF
      </a>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getProductImageUrl(design.fileUrl)}
      alt="Your design"
      className={`object-contain ${className ?? ""}`}
    />
  );
}

export default function DesignFlowModal({
  productId,
  jobs,
  startIndex,
  templates,
  printSize,
  designs,
  onDesignChange,
  onClose,
  onAddToCart,
}: Props) {
  const [index, setIndex] = useState(startIndex);
  const [step, setStep] = useState<Step>(() => (designs[jobs[startIndex]?.id] ? "review" : "choose"));
  const [templateId, setTemplateId] = useState<number | null>(templates[0]?.id ?? null);
  const [approveChecked, setApproveChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Customer's uploaded image while it is open in the editor (object URL, revoked when replaced). */
  const [uploadedImage, setUploadedImage] = useState<{
    url: string;
    width: number;
    height: number;
    /** Pre-edit image; saved with the design so it can be reopened with its layers. */
    file: Blob;
    /** Layers to restore when reopening a saved upload. */
    designState: Record<string, unknown> | null;
    /** Just picked from the device (vs. reopened from a saved design). */
    fresh: boolean;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearUploadedImage = () => {
    setUploadedImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
  };
  useEffect(() => () => clearUploadedImage(), []);

  const job = jobs[index];
  const design = job ? designs[job.id] : undefined;
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;
  const canCreate = templates.length > 0 || printSize != null;
  const sizeKey = printSizeKey(templates.length > 0 ? null : printSize);

  // Blank canvas is built once per size; it is a few KB but re-encoding on every render is wasteful.
  const blankSource = useMemo(
    () => (templates.length === 0 && printSize ? blankCanvasDataUrl(printSize) : null),
    [templates.length, printSize]
  );

  useEffect(() => {
    setApproveChecked(false);
    setError(null);
  }, [index, step]);

  // Keep the editor on the template a previous design was made with.
  useEffect(() => {
    if (design?.templateId != null && templates.some((t) => t.id === design.templateId)) {
      setTemplateId(design.templateId);
    }
  }, [design?.templateId, templates]);

  const goToJob = (nextIndex: number) => {
    if (nextIndex >= jobs.length) {
      setStep("summary");
      return;
    }
    setIndex(nextIndex);
    setStep(designs[jobs[nextIndex].id] ? "review" : "choose");
  };

  const saveDesign = async (fields: Omit<DesignUploadFields, "productId">) => {
    const payload: DesignUploadFields = {
      ...fields,
      productId,
      templateId: templates.length > 0 ? templateId : null,
      widthIn: templates.length > 0 ? null : printSize?.widthIn ?? null,
      heightIn: templates.length > 0 ? null : printSize?.heightIn ?? null,
    };
    const { design: saved } = design
      ? await designsAPI.replace(design.id, payload)
      : await designsAPI.create(payload);
    onDesignChange(job.id, { ...saved, sizeKey });
    setStep("review");
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    try {
      if (isPdf) {
        // PDFs cannot be edited in the browser editor; save as-is and go to review.
        await saveDesign({ file, fileName: file.name, source: "uploaded" });
        return;
      }
      // Images open in the editor so the customer can crop to the job shape and add text on top.
      await openImageInEditor(file, null, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const openImageInEditor = async (
    file: Blob,
    designState: Record<string, unknown> | null,
    fresh: boolean
  ) => {
    const url = URL.createObjectURL(file);
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Could not read this image. Use a PNG or JPG file."));
      img.src = url;
    }).catch((err) => {
      URL.revokeObjectURL(url);
      throw err;
    });
    clearUploadedImage();
    setUploadedImage({ url, ...size, file, designState, fresh });
    setStep("editor");
  };

  /** "Edit my design": reopen the editor with the saved layers (created) or the uploaded image and its layers. */
  const handleEditMyDesign = async () => {
    if (!design) return;
    if (design.source === "created" && canCreate) {
      setStep("editor");
      return;
    }
    if (design.source !== "uploaded" || isPdfDesign(design)) {
      setStep("choose");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const original = await designsAPI.getOriginal(design.id);
      // Without a stored original the saved design itself is the starting image, so there are no layers to restore.
      await openImageInEditor(original, design.hasOriginal ? design.designState : null, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open your design.");
    } finally {
      setBusy(false);
    }
  };

  const handleEditorExport = async ({ file, designState }: DesignEditorExport) => {
    if (uploadedImage) {
      await saveDesign({
        file,
        fileName: "design.png",
        source: "uploaded",
        designState,
        original: uploadedImage.file,
      });
      clearUploadedImage();
      return;
    }
    await saveDesign({ file, fileName: "design.png", source: "created", designState });
  };

  const handleSkip = () => {
    onDesignChange(job.id, null);
    goToJob(index + 1);
  };

  const handleContinue = async () => {
    if (!design || !approveChecked) return;
    setBusy(true);
    setError(null);
    try {
      const { design: approved } = await designsAPI.approve(design.id);
      onDesignChange(job.id, { ...approved, sizeKey: design.sizeKey });
      goToJob(index + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve the design.");
    } finally {
      setBusy(false);
    }
  };

  // Load templates through the API: the editor needs a CORS-enabled image to export, which Spaces does not send.
  const editorSource = uploadedImage
    ? uploadedImage.url
    : selectedTemplate?.id != null
      ? `${getBackendBaseUrl()}/api/products/design-templates/${selectedTemplate.id}/image`
      : blankSource;
  const editorSourceSize = uploadedImage
    ? { width: uploadedImage.width, height: uploadedImage.height }
    : selectedTemplate
      ? { width: selectedTemplate.image_width_px, height: selectedTemplate.image_height_px }
      : null;
  // Crop is locked to the job shape: the template's shape, or the customer's width × height.
  const cropRatio = selectedTemplate
    ? selectedTemplate.image_width_px / selectedTemplate.image_height_px
    : printSize
      ? printSize.widthIn / printSize.heightIn
      : null;
  // Reopen the saved layers only when the design was made on the same canvas.
  const reusableState =
    design?.source === "created" &&
    (design.templateId ?? null) === (templates.length > 0 ? templateId : null) &&
    design.sizeKey === sizeKey
      ? design.designState
      : null;

  if (step === "editor" && editorSource && job) {
    return (
      <div className="fixed inset-0 z-[200] bg-white">
        <DesignEditor
          key={`${job.id}-${uploadedImage?.url ?? templateId ?? "blank"}`}
          source={editorSource}
          sourceSize={editorSourceSize}
          startOnCrop={uploadedImage?.fresh === true && cropRatio != null}
          cropRatio={cropRatio}
          jobLabel={jobLabel(job, index)}
          initialDesignState={uploadedImage ? uploadedImage.designState : reusableState}
          onBack={() => {
            const freshUpload = uploadedImage?.fresh === true;
            clearUploadedImage();
            setStep(freshUpload || !design ? "choose" : "review");
          }}
          onExport={handleEditorExport}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <p className="text-sm text-gray-600">
            {step === "summary"
              ? "Final step"
              : `Artwork ${index + 1} of ${jobs.length}${job ? ` · ${jobLabel(job, index)}` : ""}`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close design tool"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {error ? <p className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          {step === "choose" && job ? (
            <div className="flex flex-col items-center gap-5 py-6">
              {templates.length > 1 ? (
                <div className="w-full">
                  <p className="mb-2 text-sm font-medium text-gray-700">Choose a template</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {templates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id ?? null)}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-2 text-xs ${
                          t.id === templateId ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={getProductImageUrl(t.image_url)} alt="" className="h-24 w-full object-contain" />
                        <span className="text-gray-800">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
                className="hidden"
                onChange={(e) => void handleUpload(e)}
              />
              <div className="flex w-full max-w-xs flex-col gap-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy ? "Uploading…" : "Upload from this device"}
                </button>
                {canCreate ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStep("editor")}
                    className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Create Design
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSkip}
                  className="text-sm text-gray-500 underline hover:text-gray-700"
                >
                  Skip – upload after order
                </button>
              </div>
              <p className="text-center text-xs text-gray-500">PNG, JPG or single-page PDF, up to 25MB.</p>
            </div>
          ) : null}

          {step === "review" && job && design ? (
            <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
              <div className="flex min-h-[320px] items-center justify-center rounded-lg bg-gray-100 p-4">
                <DesignPreview design={design} className="max-h-[60vh] max-w-full shadow" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-semibold text-gray-900">Review your design</h2>
                <p className="mt-1 text-sm text-gray-600">Double-check the following details before you continue.</p>
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-700">
                  {REVIEW_CHECKLIST.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="mt-auto space-y-3 pt-8">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-800">
                    <input
                      type="checkbox"
                      checked={approveChecked}
                      onChange={(e) => setApproveChecked(e.target.checked)}
                      className="h-4 w-4"
                    />
                    I have reviewed and approve my design.
                  </label>
                  <button
                    type="button"
                    disabled={!approveChecked || busy}
                    onClick={() => void handleContinue()}
                    className="w-full rounded-md bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Saving…" : "Continue"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleEditMyDesign()}
                    className="w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Edit my design
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === "summary" ? (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Your artwork</h2>
              <p className="mt-1 text-sm text-gray-600">
                Jobs without a design can be uploaded after you place the order.
              </p>
              <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {jobs.map((j, i) => {
                  const d = designs[j.id];
                  const ready = d?.approved;
                  return (
                    <li key={j.id} className="flex items-center gap-4 p-3">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-100">
                        {d ? <DesignPreview design={d} className="max-h-full max-w-full" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{jobLabel(j, i)}</p>
                        <p className="text-xs text-gray-500">
                          Qty {j.quantity} ·{" "}
                          {ready ? (
                            <span className="text-emerald-600">Design approved</span>
                          ) : d ? (
                            <span className="text-amber-600">Not approved yet</span>
                          ) : (
                            <span>Upload after order</span>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIndex(i);
                          setStep(d ? "review" : "choose");
                        }}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {d ? "Edit" : "Add design"}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Back to product
                </button>
                <button
                  type="button"
                  onClick={onAddToCart}
                  className="rounded-md bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Add to cart
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
