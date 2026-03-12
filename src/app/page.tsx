"use client";

import { useState, useEffect, Suspense } from "react";
import LoginPage from "./components/LoginPage";
import ReasonsSection from "./components/ReasonsSection";
import Navbar from "./components/Navbar";
import Products from "./components/Products";
import FacilitiesBanner from "./components/FacilitiesBanner";
import ShippingBanner from "./components/ShippingBanner";
import Footer from "./components/Footer";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check login status on mount
    const checkLoginStatus = () => {
      const loggedIn = localStorage.getItem("isLoggedIn") === "true";
      const token = localStorage.getItem("token");
      setIsLoggedIn(loggedIn && !!token); // Only logged in if both token and flag exist
    };

    checkLoginStatus();

    // Listen for custom login status change event (from login/register)
    window.addEventListener("loginStatusChanged", checkLoginStatus);
    
    // Also listen for storage changes (when login happens in another tab/window)
    window.addEventListener("storage", checkLoginStatus);

    return () => {
      window.removeEventListener("loginStatusChanged", checkLoginStatus);
      window.removeEventListener("storage", checkLoginStatus);
    };
  }, []);

  return (
    <>
      <Navbar />
      {/* {!isLoggedIn && (
        <>
          <LoginPage  />
          <ReasonsSection />
        </>
      )} */}
      <Suspense fallback={<div className="text-center py-12"><p className="text-gray-600">Loading products...</p></div>}>
        <Products />
      </Suspense>
     {/* <FacilitiesBanner /> */}
       <ShippingBanner />
      <Footer />
    </>
  );
}
