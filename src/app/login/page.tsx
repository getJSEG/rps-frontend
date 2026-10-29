import { Suspense } from "react";
import Navbar from "../components/Navbar";
import LoginPage from "../components/LoginPage";
import Footer from "../components/Footer";

export default function LoginRoutePage() {
  return (
    <>
      <Navbar />
      <Suspense fallback={<div className="min-h-screen bg-gray-50 pt-24" />}>
        <LoginPage />
      </Suspense>
      <Footer />
    </>
  );
}
