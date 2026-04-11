import { Suspense } from "react";
import Navbar from "../../../components/Navbar";
import Footer from "../../../components/Footer";
import ArtworkReviewOkClient from "../../../components/artwork-review/ArtworkReviewOkClient";

export default function ArtworkReviewOkPage() {
  return (
    <>
      <Navbar />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#f0f0f0] pb-16 pt-24">
            <div className="mx-auto w-3/4 max-w-full px-4 py-16 text-center text-gray-600">Loading…</div>
          </div>
        }
      >
        <ArtworkReviewOkClient />
      </Suspense>
      <Footer />
    </>
  );
}
