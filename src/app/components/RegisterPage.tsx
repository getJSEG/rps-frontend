"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authAPI } from "../../utils/api";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    hearAboutUs: "",
    streetAddress: "",
    addressLine2: "",
    city: "",
    state: "",
    postcode: "",
    telephone: "",
    shippingSameAsBilling: false,
    shippingStreetAddress: "",
    shippingAddressLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPostcode: "",
    shippingCountry: "United States",
    shippingTelephone: "",
    newsletter: false,
    termsAccepted: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const showFormError = (message: string) => {
    setError(message);
    toast.error(message);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      if (name === "shippingSameAsBilling" && checked) {
        // Copy billing address to shipping address
        setFormData((prev) => ({
          ...prev,
          shippingSameAsBilling: true,
          shippingStreetAddress: prev.streetAddress,
          shippingAddressLine2: prev.addressLine2,
          shippingCity: prev.city,
          shippingState: prev.state,
          shippingPostcode: prev.postcode,
          shippingTelephone: prev.telephone,
        }));
      } else {
        setFormData((prev) => ({ ...prev, [name]: checked }));
      }
    } else {
      setFormData((prev) => {
        const updated = { ...prev, [name]: value };
        // If shipping same as billing is checked, update shipping fields when billing fields change
        if (prev.shippingSameAsBilling) {
          if (name === "streetAddress") updated.shippingStreetAddress = value;
          if (name === "addressLine2") updated.shippingAddressLine2 = value;
          if (name === "city") updated.shippingCity = value;
          if (name === "state") updated.shippingState = value;
          if (name === "postcode") updated.shippingPostcode = value;
          if (name === "telephone") updated.shippingTelephone = value;
        }
        return updated;
      });
    }
    // Clear errors when user types
    if (error) setError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    const submittedData = new FormData(e.currentTarget);

    const getTextValue = (key: string, fallback: string = "") => {
      const value = submittedData.get(key);
      if (typeof value === "string") {
        return value.trim();
      }
      return fallback.trim();
    };

    const payload = {
      email: getTextValue("email", formData.email),
      password: getTextValue("password", formData.password),
      confirmPassword: getTextValue("confirmPassword", formData.confirmPassword),
      fullName: getTextValue("fullName", formData.fullName),
      hearAboutUs: getTextValue("hearAboutUs", formData.hearAboutUs),
      streetAddress: getTextValue("streetAddress", formData.streetAddress),
      addressLine2: getTextValue("addressLine2", formData.addressLine2),
      city: getTextValue("city", formData.city),
      state: getTextValue("state", formData.state),
      postcode: getTextValue("postcode", formData.postcode),
      telephone: getTextValue("telephone", formData.telephone),
      shippingStreetAddress: getTextValue("shippingStreetAddress", formData.shippingStreetAddress),
      shippingAddressLine2: getTextValue("shippingAddressLine2", formData.shippingAddressLine2),
      shippingCity: getTextValue("shippingCity", formData.shippingCity),
      shippingState: getTextValue("shippingState", formData.shippingState),
      shippingPostcode: getTextValue("shippingPostcode", formData.shippingPostcode),
      shippingCountry: getTextValue("shippingCountry", formData.shippingCountry || "United States"),
      shippingTelephone: getTextValue("shippingTelephone", formData.shippingTelephone),
      shippingSameAsBilling: formData.shippingSameAsBilling,
      newsletter: formData.newsletter,
      termsAccepted: formData.termsAccepted,
    };

    if (payload.password !== payload.confirmPassword) {
      const msg = "Passwords do not match.";
      showFormError(msg);
      return;
    }

    if (payload.password.length < 6) {
      const msg = "Password must be at least 6 characters long.";
      showFormError(msg);
      return;
    }

    if (!payload.email || !payload.fullName ||
        !payload.hearAboutUs || !payload.streetAddress ||
        !payload.city || !payload.state || !payload.postcode || !payload.telephone) {
      const msg = "Please fill in all required fields.";
      showFormError(msg);
      return;
    }

    if (!payload.termsAccepted) {
      const msg = "Please accept the terms and conditions.";
      showFormError(msg);
      return;
    }

    if (!payload.shippingSameAsBilling) {
      if (!payload.shippingStreetAddress || !payload.shippingCity ||
          !payload.shippingState || !payload.shippingPostcode || !payload.shippingTelephone) {
        const msg = "Please fill in all required shipping address fields.";
        showFormError(msg);
        return;
      }
    }

    setLoading(true);

    try {
      const response = await authAPI.register({
        email: payload.email,
        password: payload.password,
        fullName: payload.fullName,
        hearAboutUs: payload.hearAboutUs,
        streetAddress: payload.streetAddress,
        addressLine2: payload.addressLine2 || undefined,
        city: payload.city,
        state: payload.state,
        postcode: payload.postcode,
        telephone: payload.telephone,
        shippingSameAsBilling: payload.shippingSameAsBilling,
        shippingStreetAddress: payload.shippingSameAsBilling ? payload.streetAddress : payload.shippingStreetAddress,
        shippingAddressLine2: payload.shippingSameAsBilling ? (payload.addressLine2 || undefined) : (payload.shippingAddressLine2 || undefined),
        shippingCity: payload.shippingSameAsBilling ? payload.city : payload.shippingCity,
        shippingState: payload.shippingSameAsBilling ? payload.state : payload.shippingState,
        shippingPostcode: payload.shippingSameAsBilling ? payload.postcode : payload.shippingPostcode,
        shippingCountry: payload.shippingCountry,
        shippingTelephone: payload.shippingSameAsBilling ? payload.telephone : payload.shippingTelephone,
        newsletter: payload.newsletter,
        termsAccepted: payload.termsAccepted,
      });

      // Store token and user info
      if (response.token) {
        localStorage.setItem("token", response.token);
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem("user", JSON.stringify(response.user));
        
        // Store user role separately for easy access
        if (response.user && response.user.role) {
          localStorage.setItem("userRole", response.user.role);
        }
        
        // Store email and password temporarily for login form pre-fill
        // (Only if registration was successful and user might need to login again)
        localStorage.setItem("registeredEmail", payload.email);
        localStorage.setItem("registeredPassword", payload.password);
        
        setSuccess(response.message || "Registration successful! Redirecting to home page...");
        toast.success(response.message || "Registration successful!");
        window.dispatchEvent(new Event("loginStatusChanged"));
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err: unknown) {
      console.error("Registration error:", err);
      let msg: string;
      const errorMessage = err instanceof Error ? err.message : "";
      if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError")) {
        msg = "Cannot connect to server. Check your connection and that the API is running.";
      } else if (errorMessage.includes("Email already registered")) {
        msg = "This email is already registered. Please use a different email or try logging in.";
      } else if (errorMessage.includes("Missing required fields")) {
        msg = "Please fill in all required fields.";
      } else if (errorMessage.includes("Please accept the terms and conditions")) {
        msg = "Please accept the terms and conditions.";
      } else if (errorMessage.includes("Password must be at least")) {
        msg = "Password must be at least 6 characters long.";
      } else if (errorMessage.includes("uppercase letter and one number")) {
        msg = "Password must include at least one uppercase letter and one number.";
      } else {
        msg = errorMessage || "Registration failed. Please check your connection and try again.";
      }
      showFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  const stateOptions = [
    "Alabama",
    "Alaska",
    "Arizona",
    "Arkansas",
    "California",
    "Colorado",
    "Connecticut",
    "Delaware",
    "Florida",
    "Georgia",
    "Hawaii",
    "Idaho",
    "Illinois",
    "Indiana",
    "Iowa",
    "Kansas",
    "Kentucky",
    "Louisiana",
    "Maine",
    "Maryland",
    "Massachusetts",
    "Michigan",
    "Minnesota",
    "Mississippi",
    "Missouri",
    "Montana",
    "Nebraska",
    "Nevada",
    "New Hampshire",
    "New Jersey",
    "New Mexico",
    "New York",
    "North Carolina",
    "North Dakota",
    "Ohio",
    "Oklahoma",
    "Oregon",
    "Pennsylvania",
    "Rhode Island",
    "South Carolina",
    "South Dakota",
    "Tennessee",
    "Texas",
    "Utah",
    "Vermont",
    "Virginia",
    "Washington",
    "West Virginia",
    "Wisconsin",
    "Wyoming",
  ];

  const hearAboutUsOptions = [
    "Google Search",
    "Social Media",
    "Referral",
    "Trade Show",
    "Advertisement",
    "Other",
  ];

  const inputClass =
    "w-full px-3.5 py-2 border border-slate-300 text-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm";
  const disabledInputClass =
    "w-full px-3.5 py-2 border border-slate-200 rounded-md text-slate-500 bg-slate-100 cursor-not-allowed";
  const labelClass = "text-slate-800 font-medium text-sm";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create Account</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-md p-6 md:p-8">
          {/* Success Message */}
          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-md mb-6 text-sm">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-md mb-6 text-sm">
              {error}
            </div>
          )}

          {/* Trade Account Information Section */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-5 pb-2 border-b border-slate-200">
              Account Information
            </h2>

            <div className="space-y-4">
              {/* Email Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Email Address: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Email"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Password: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    className={`${inputClass} pr-10`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Confirm Password: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2 relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm Password"
                    className={`${inputClass} pr-10`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Full Name */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Full Name: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="First and Last Name"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* How did you hear about us? */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  How did you hear about us?: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <select
                    name="hearAboutUs"
                    value={formData.hearAboutUs}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    <option value="" disabled>
                      Select Option
                    </option>
                    {hearAboutUsOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-8"></div>

          {/* Billing Information Section */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-5 pb-2 border-b border-slate-200">
              Billing Information
            </h2>

            <div className="space-y-3">
              {/* Street Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Street Address: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    placeholder="Street Address"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Address Line 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>Address Line 2:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    placeholder="Address Line 2"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* City */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  City: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* State */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  State: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className={inputClass}
                    required
                  >
                    <option value="" disabled>
                      Select State
                    </option>
                    {stateOptions.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Postcode: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="postcode"
                    value={formData.postcode}
                    onChange={handleChange}
                    placeholder="Postcode"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>Country:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value="United States"
                    disabled
                    className={disabledInputClass}
                  />
                </div>
              </div>

              {/* Telephone */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Telephone: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    placeholder="Telephone"
                    className={inputClass}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-200 my-8"></div>

          {/* Shipping Information Section */}
          <div className="mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
            <div className="mb-5 flex flex-col gap-3 border-b border-slate-200 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Shipping Information
              </h2>
              <div className="flex items-center sm:justify-end">
                <input
                  type="checkbox"
                  id="shippingSameAsBilling"
                  name="shippingSameAsBilling"
                  checked={formData.shippingSameAsBilling}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="shippingSameAsBilling" className="ml-2 text-slate-700 font-medium text-sm">
                  Shipping Address is same as billing
                </label>
              </div>
            </div>

            <div className="space-y-3">
              {/* Street Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Street Address: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingStreetAddress"
                    value={formData.shippingStreetAddress}
                    onChange={handleChange}
                    placeholder="Street Address"
                    disabled={formData.shippingSameAsBilling}
                    className={`${inputClass} ${
                      formData.shippingSameAsBilling ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Address Line 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>Address Line 2:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingAddressLine2"
                    value={formData.shippingAddressLine2}
                    onChange={handleChange}
                    placeholder="Address Line 2"
                    disabled={formData.shippingSameAsBilling}
                    className={`${inputClass} ${
                      formData.shippingSameAsBilling ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                  />
                </div>
              </div>

              {/* City */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  City: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingCity"
                    value={formData.shippingCity}
                    onChange={handleChange}
                    placeholder="City"
                    disabled={formData.shippingSameAsBilling}
                    className={`${inputClass} ${
                      formData.shippingSameAsBilling ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* State */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  State: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <select
                    name="shippingState"
                    value={formData.shippingState}
                    onChange={handleChange}
                    disabled={formData.shippingSameAsBilling}
                    className={`${inputClass} ${
                      formData.shippingSameAsBilling ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                    required
                  >
                    <option value="" disabled>
                      Select State
                    </option>
                    {stateOptions.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Postcode: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingPostcode"
                    value={formData.shippingPostcode}
                    onChange={handleChange}
                    placeholder="Postcode"
                    disabled={formData.shippingSameAsBilling}
                    className={`${inputClass} ${
                      formData.shippingSameAsBilling ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>Country:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingCountry"
                    value={formData.shippingCountry}
                    disabled
                    className={disabledInputClass}
                  />
                </div>
              </div>

              {/* Telephone */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                <label className={labelClass}>
                  Telephone: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="tel"
                    name="shippingTelephone"
                    value={formData.shippingTelephone}
                    onChange={handleChange}
                    placeholder="Telephone"
                    disabled={formData.shippingSameAsBilling}
                    className={`${inputClass} ${
                      formData.shippingSameAsBilling ? "bg-slate-100 text-slate-500 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-3 mb-8 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:p-5">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="newsletter"
                name="newsletter"
                checked={formData.newsletter}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded text-black focus:ring-blue-500"
              />
              <label htmlFor="newsletter" className="ml-2 text-slate-700 text-sm">
                I would like to receive website email newsletters
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="termsAccepted"
                name="termsAccepted"
                checked={formData.termsAccepted}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded text-black focus:ring-blue-500"
                required
              />
              <label htmlFor="termsAccepted" className="ml-2 text-slate-700 text-sm">
                I agree to the Terms and Conditions <span className="text-red-500">*</span>
              </label>
            </div>

          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              type="submit"
              disabled={loading}
              className="bg-[#0B6BCB] hover:bg-blue-700 text-white font-semibold text-base px-10 py-3.5 rounded-md transition-colors shadow-sm border border-[#0B6BCB] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Registering..." : "Register Now!"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

