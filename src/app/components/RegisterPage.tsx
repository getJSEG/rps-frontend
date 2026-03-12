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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (!formData.termsAccepted) {
      const msg = "You must accept the Terms and Conditions to register.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (formData.password.length < 6) {
      const msg = "Password must be at least 6 characters long.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!formData.email || !formData.fullName ||
        !formData.hearAboutUs || !formData.streetAddress ||
        !formData.city || !formData.state || !formData.postcode || !formData.telephone) {
      const msg = "Please fill in all required fields.";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!formData.shippingSameAsBilling) {
      if (!formData.shippingStreetAddress || !formData.shippingCity ||
          !formData.shippingState || !formData.shippingPostcode || !formData.shippingTelephone) {
        const msg = "Please fill in all required shipping address fields.";
        setError(msg);
        toast.error(msg);
        return;
      }
    }

    setLoading(true);

    try {
      const response = await authAPI.register({
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        hearAboutUs: formData.hearAboutUs,
        streetAddress: formData.streetAddress,
        addressLine2: formData.addressLine2 || undefined,
        city: formData.city,
        state: formData.state,
        postcode: formData.postcode,
        telephone: formData.telephone,
        shippingSameAsBilling: formData.shippingSameAsBilling,
        shippingStreetAddress: formData.shippingSameAsBilling ? formData.streetAddress : formData.shippingStreetAddress,
        shippingAddressLine2: formData.shippingSameAsBilling ? (formData.addressLine2 || undefined) : (formData.shippingAddressLine2 || undefined),
        shippingCity: formData.shippingSameAsBilling ? formData.city : formData.shippingCity,
        shippingState: formData.shippingSameAsBilling ? formData.state : formData.shippingState,
        shippingPostcode: formData.shippingSameAsBilling ? formData.postcode : formData.shippingPostcode,
        shippingCountry: formData.shippingCountry,
        shippingTelephone: formData.shippingSameAsBilling ? formData.telephone : formData.shippingTelephone,
        newsletter: formData.newsletter,
        termsAccepted: formData.termsAccepted,
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
        localStorage.setItem("registeredEmail", formData.email);
        localStorage.setItem("registeredPassword", formData.password);
        
        setSuccess(response.message || "Registration successful! Redirecting to home page...");
        toast.success(response.message || "Registration successful!");
        window.dispatchEvent(new Event("loginStatusChanged"));
        setTimeout(() => {
          router.push("/");
        }, 1500);
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      let msg: string;
      if (err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError")) {
        msg = "Cannot connect to server. Check your connection and that the API is running.";
      } else if (err.message?.includes("Email already registered")) {
        msg = "This email is already registered. Please use a different email or try logging in.";
      } else if (err.message?.includes("Missing required fields")) {
        msg = "Please fill in all required fields.";
      } else if (err.message?.includes("Password must be at least")) {
        msg = "Password must be at least 6 characters long.";
      } else {
        msg = err.message || "Registration failed. Please check your connection and try again.";
      }
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const states = [
    "Select State",
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
    "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
    "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma",
    "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming",
  ];

  const hearAboutUsOptions = [
    "Select Option",
    "Google Search",
    "Social Media",
    "Referral",
    "Trade Show",
    "Advertisement",
    "Other",
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Account</h1>
          <p className="text-sm text-gray-600">* Required Information</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
          {/* Success Message */}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
              {success}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

          {/* Trade Account Information Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
            Account Information
            </h2>

            <div className="space-y-4">
              {/* Email Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Email Address: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                     placeholder="Email"
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Password: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2 relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Password"
                    className="w-full px-4 py-2 pr-10 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Confirm Password: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2 relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm Password"
                    className="w-full px-4 py-2 pr-10 border text-black border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((s) => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Full Name: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="First and Last Name"
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* How did you hear about us? */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  How did you hear about us?: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <select
                    name="hearAboutUs"
                    value={formData.hearAboutUs}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
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
          <div className="border-t border-gray-300 my-8"></div>

          {/* Billing Information Section */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Billing Information
            </h2>

            <div className="space-y-4">
              {/* Street Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Street Address: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="streetAddress"
                    value={formData.streetAddress}
                    onChange={handleChange}
                    placeholder="Street Address"
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Address Line 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">Address Line 2:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="addressLine2"
                    value={formData.addressLine2}
                    onChange={handleChange}
                    placeholder="Address Line 2"
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* City */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  City: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="City"
                    className="w-full px-4 py-2 border border-gray-300 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* State */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  State: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <select
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Postcode: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="postcode"
                    value={formData.postcode}
                    onChange={handleChange}
                    placeholder="Postcode"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">Country:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    value="United States"
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Telephone */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  Telephone: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    placeholder="Telephone"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-300 my-8"></div>

          {/* Shipping Information Section */}
          <div className="mb-8">
            {/* Shipping Address Same as Billing Checkbox */}
            <div className="mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="shippingSameAsBilling"
                  name="shippingSameAsBilling"
                  checked={formData.shippingSameAsBilling}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="shippingSameAsBilling" className="ml-2 text-gray-700 font-medium">
                  Shipping Address is same as billing
                </label>
              </div>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 mb-6">
              Shipping Information
            </h2>

            <div className="space-y-4">
              {/* Street Address */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
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
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.shippingSameAsBilling ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Address Line 2 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">Address Line 2:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingAddressLine2"
                    value={formData.shippingAddressLine2}
                    onChange={handleChange}
                    placeholder="Address Line 2"
                    disabled={formData.shippingSameAsBilling}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.shippingSameAsBilling ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                  />
                </div>
              </div>

              {/* City */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
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
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.shippingSameAsBilling ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* State */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
                  State: <span className="text-red-500">*</span>
                </label>
                <div className="md:col-span-2">
                  <select
                    name="shippingState"
                    value={formData.shippingState}
                    onChange={handleChange}
                    disabled={formData.shippingSameAsBilling}
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${
                      formData.shippingSameAsBilling ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    required
                  >
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Postcode */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
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
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.shippingSameAsBilling ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>

              {/* Country */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">Country:</label>
                <div className="md:col-span-2">
                  <input
                    type="text"
                    name="shippingCountry"
                    value={formData.shippingCountry}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black bg-gray-100 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Telephone */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label className="text-gray-700 font-medium">
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
                    className={`w-full px-4 py-2 border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      formData.shippingSameAsBilling ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="space-y-4 mb-8">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="newsletter"
                name="newsletter"
                checked={formData.newsletter}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded text-black focus:ring-blue-500"
              />
              <label htmlFor="newsletter" className="ml-2 text-gray-700">
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
              <label htmlFor="termsAccepted" className="ml-2 text-gray-700">
                I have read and accept the{" "}
                <a href="#" className="text-blue-600 underline hover:text-blue-800">
                  Terms and Conditions.
                </a>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="text-center">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-lg px-12 py-4 rounded-lg transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Registering..." : "Register Now!"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

