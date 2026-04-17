import Link from "next/link";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

/** Saved-card management UI removed; checkout uses Stripe Payment Element only. */
export default function CreditCardsPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 pt-24 pb-16">
        <div className="mx-auto max-w-lg px-4">
          <div className="rounded-sm border border-gray-200 bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-gray-900">Credit cards</h1>
            <p className="mt-2 text-sm text-gray-600">
              Saved card profiles are not used anymore. Pay securely with your card at checkout via Stripe.
            </p>
            <Link href="/account-settings" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
              Back to account settings
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
