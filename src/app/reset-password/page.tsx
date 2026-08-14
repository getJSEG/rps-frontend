import { Suspense } from "react";
import Navbar from "../components/Navbar";
import ResetPassword from "../components/ResetPassword";
import Footer from "../components/Footer";

export default function ResetPasswordPage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-white pt-24" />}>
        <ResetPassword />
      </Suspense>
      <Footer />
    </>
  );
}
