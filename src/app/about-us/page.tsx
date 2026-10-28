import InfoPageLayout from "../components/InfoPageLayout";

/**
 * Placeholder wording until the client sends the final About Us text — replace the paragraphs below.
 */
const ABOUT_PARAGRAPHS = [
  "Resourceful Print Solutions is an online print shop for banners, signs, posters, stickers and display hardware. We help businesses, event planners and organizations turn their ideas into professional printed products.",
  "Every order is printed with care, checked before it ships, and backed by a customer service team that is happy to help with sizes, materials and artwork questions.",
  "Whether you need a single sign or a full set of event graphics, our goal is simple: great prints, fair prices and dependable delivery.",
];

export default function AboutUsPage() {
  return (
    <InfoPageLayout title="About Us" width="text">
      <article className="space-y-4 rounded-lg border border-gray-200 bg-white px-5 py-8 text-[15px] leading-relaxed text-gray-700 shadow-sm sm:px-10 sm:py-10">
        {ABOUT_PARAGRAPHS.map((text) => (
          <p key={text}>{text}</p>
        ))}
      </article>
    </InfoPageLayout>
  );
}
