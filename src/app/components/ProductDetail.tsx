 "use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { cartAPI } from "../../utils/api";
import { isAuthenticated } from "../../utils/roles";

export default function CanvasRoll() {
  const router = useRouter();
  const [width, setWidth] = useState("0");
  const [height, setHeight] = useState("0");
  const [jobName, setJobName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [turnaround, setTurnaround] = useState("next-day");
  const [shipping, setShipping] = useState("");
  const [activeTab, setActiveTab] = useState("description");
  const [emailProof, setEmailProof] = useState(false);
  const [fullWall, setFullWall] = useState("0");
  const [halfWall, setHalfWall] = useState("0");
  const [totalJobs, setTotalJobs] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const pricePerSqFt = 3.63;
  const minCharge = 8.0;
  const sameDayFee = 8.0;
  const fullWallPrice = 50.0; // Example price per full wall
  const halfWallPrice = 30.0; // Example price per half wall

  // Calculate prices dynamically based on all fields
  const { areaSqFt, basePrice, turnaroundFee, fullWallCost, halfWallCost, subtotal, total } = useMemo(() => {
    const widthInches = parseFloat(width) || 0;
    const heightInches = parseFloat(height) || 0;
    const areaSqFt = (widthInches * heightInches) / 144;
    const basePricePerUnit = Math.max(areaSqFt * pricePerSqFt, minCharge);
    const qty = parseInt(quantity) || 1;
    const basePrice = basePricePerUnit * qty;
    
    const turnaroundFee = turnaround === "same-day" ? sameDayFee * qty : 0;
    const fullWallQty = parseInt(fullWall) || 0;
    const halfWallQty = parseInt(halfWall) || 0;
    const fullWallCost = fullWallQty * fullWallPrice;
    const halfWallCost = halfWallQty * halfWallPrice;
    
    const subtotal = basePrice + turnaroundFee + fullWallCost + halfWallCost;
    const total = subtotal * totalJobs;
    
    return {
      areaSqFt,
      basePrice,
      turnaroundFee,
      fullWallCost,
      halfWallCost,
      subtotal,
      total
    };
  }, [width, height, quantity, turnaround, fullWall, halfWall, totalJobs]);

  // Handle Add to Cart
  const handleAddToCart = async () => {
    // Require login before allowing add to cart
    if (!isAuthenticated()) {
      const errorMsg = "Please register yourself to add items to cart.";
      toast.error(errorMsg);
      setMessage("❌ " + errorMsg);
      setTimeout(() => {
        setMessage("");
        router.push("/");
      }, 2500);
      return;
    }

    // Collect all product information
    const widthVal = parseFloat(width) || 0;
    const heightVal = parseFloat(height) || 0;
    const qty = parseInt(quantity) || 1;
    const fullWallQty = parseInt(fullWall) || 0;
    const halfWallQty = parseInt(halfWall) || 0;

    // Validation
    if (!jobName.trim()) {
      setMessage("❌ Error: Please enter Job Name/PO#");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    if (isNaN(widthVal) || isNaN(heightVal)) {
      setMessage("❌ Error: Width and Height must be valid numbers");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    if (widthVal <= 0 || heightVal <= 0) {
      setMessage("❌ Error: Width and Height must be greater than 0.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Create cart item
      const cartItem = {
        productName: "Canvas Roll",
        width: widthVal,
        height: heightVal,
        areaSqFt: parseFloat(areaSqFt.toFixed(2)),
        quantity: qty,
        jobName: jobName.trim(),
        turnaround: turnaround,
        shipping: shipping,
        emailProof: emailProof,
        fullWall: fullWallQty,
        halfWall: halfWallQty,
        totalJobs: totalJobs,
        unitPrice: parseFloat((basePrice / qty).toFixed(2)),
        subtotal: parseFloat(subtotal.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        timestamp: new Date().toISOString()
      };

      // Send to backend cart API (requires authenticated user)
      await cartAPI.add(cartItem);

      const successMsg = "✅ Product added to cart successfully!";
      setMessage(successMsg);
      setTimeout(() => setMessage(""), 5000);

      // Dispatch event to update cart count in navbar
      try {
        window.dispatchEvent(new Event("cartUpdated"));
      } catch (_) {}

    } catch (error: any) {
      const errorMsg = `❌ Error: ${error.message || "Failed to add product to cart"}`;
      setMessage(errorMsg);
      setTimeout(() => setMessage(""), 8000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Left Panel - Product Image and Details */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Canvas Roll</h1>

            {/* Main Product Image */}
            <div className="mb-4">
              <div className="w-full h-96 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-64 h-64 bg-white border-2 border-gray-400 rounded relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-gray-300 to-gray-500"></div>
                    <div className="absolute top-4 left-4 right-4 text-white text-xs font-bold">
                      WORK JOY AND PEACE
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Rolled Canvas Print</p>
                </div>
              </div>
            </div>

            {/* Thumbnail */}
            <div className="mb-6">
              <div className="w-20 h-20 bg-gray-100 border border-gray-300 rounded cursor-pointer hover:border-blue-500">
                <div className="w-full h-full bg-gradient-to-b from-gray-300 to-gray-500 rounded"></div>
              </div>
            </div>

            {/* Price */}
            <div className="mb-6">
              <p className="text-lg font-semibold text-gray-900">
                ${pricePerSqFt.toFixed(2)} per ft²
              </p>
            </div>

            {/* Product Features */}
            <div className="mb-6">
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Photo quality printed artist canvas material</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Unstretched - arrives rolled</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Great for posters, or to stretch on canvas bars</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Custom sizes</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Panel - Configuration and Order */}
          <div>
            {/* Size Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Size</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Width
                  </label>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500 ml-2">inch</span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Height
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                  <span className="text-sm text-gray-500 ml-2">inch</span>
                </div>
              </div>
              <div className="text-sm text-gray-700">
                {width} x {height} = {areaSqFt.toFixed(2)} ft²
                <span className="ml-2">${pricePerSqFt.toFixed(2)}/ft²</span>
                <span className="ml-2 text-gray-500">min charge ${minCharge.toFixed(2)}</span>
              </div>
            </div>

            {/* Material Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Material</h2>
              <p className="text-gray-700">15mil. White Canvas</p>
            </div>

            {/* Job Details Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Job Details</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Name/PO# <span className="text-red-500">(Required)</span>
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Job Name/PO#"
                />
              </div>
              <div className="mb-4">
                <a href="#" className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
                  + Add Another Job
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </a>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Total Jobs</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTotalJobs(Math.max(1, totalJobs - 1))}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={totalJobs}
                    onChange={(e) => setTotalJobs(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => setTotalJobs(totalJobs + 1)}
                    className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Qty</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Price</label>
                  <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50">
                    ${(basePrice / (parseInt(quantity) || 1)).toFixed(2)}
                  </div>
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Wall</label>
                <input
                  type="number"
                  value={fullWall}
                  onChange={(e) => setFullWall(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="0"
                />
                {parseInt(fullWall) > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    {fullWall} x ${fullWallPrice.toFixed(2)} = ${fullWallCost.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Half Wall</label>
                <input
                  type="number"
                  value={halfWall}
                  onChange={(e) => setHalfWall(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  placeholder="0"
                />
                {parseInt(halfWall) > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    {halfWall} x ${halfWallPrice.toFixed(2)} = ${halfWallCost.toFixed(2)}
                  </p>
                )}
              </div>
              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Price:</span>
                  <span className="text-lg font-bold text-gray-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Turnaround Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Turnaround</h2>
              <div className="space-y-3">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="turnaround"
                    value="next-day"
                    checked={turnaround === "next-day"}
                    onChange={(e) => setTurnaround(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Next Day</div>
                    <div className="text-sm text-gray-600">
                      Cut-off time 4pm PST <span className="text-green-600">Free</span>
                    </div>
                  </div>
                </label>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="turnaround"
                    value="same-day"
                    checked={turnaround === "same-day"}
                    onChange={(e) => setTurnaround(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Same Day</div>
                    <div className="text-sm text-gray-600">
                      Cut-off time 12pm PST <span className="text-red-600">+${sameDayFee.toFixed(2)}</span>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Shipping Section */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Shipping</h2>
              <div className="space-y-3">
                {/* <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="shipping"
                    value="blind-drop"
                    checked={shipping === "blind-drop"}
                    onChange={(e) => setShipping(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-gray-900">Blind Drop Ship</span>
                </label> */}
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="shipping"
                    value="store-pickup"
                    checked={shipping === "store-pickup"}
                    onChange={(e) => setShipping(e.target.value)}
                    className="mr-3"
                  />
                  <span className="text-gray-900">
                    Store Pickup <span className="text-gray-600 text-sm">(Available in CA, TX and PA Facility)</span>
                  </span>
                </label>
              </div>
            </div>

            {/* Order Summary */}
            <div className="mb-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex justify-between mb-2">
                <span className="text-gray-700">Base Price</span>
                <span className="text-gray-900 font-medium">${basePrice.toFixed(2)}</span>
              </div>
              {turnaroundFee > 0 && (
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Turnaround Fee</span>
                  <span className="text-gray-900 font-medium">${turnaroundFee.toFixed(2)}</span>
                </div>
              )}
              {fullWallCost > 0 && (
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Full Wall ({fullWall})</span>
                  <span className="text-gray-900 font-medium">${fullWallCost.toFixed(2)}</span>
                </div>
              )}
              {halfWallCost > 0 && (
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Half Wall ({halfWall})</span>
                  <span className="text-gray-900 font-medium">${halfWallCost.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between mb-2 pt-2 border-t border-gray-300">
                <span className="text-gray-700">Subtotal</span>
                <span className="text-gray-900 font-medium">${subtotal.toFixed(2)}</span>
              </div>
              {totalJobs > 1 && (
                <div className="flex justify-between mb-2">
                  <span className="text-gray-700">Total Jobs ({totalJobs})</span>
                  <span className="text-gray-900 font-medium">x {totalJobs}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-300">
                <span className="text-gray-900 font-bold">Total</span>
                <span className="text-gray-900 font-bold text-xl">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Message Display */}
            {message && (
              <div className={`mb-4 p-3 rounded-lg ${
                message.includes("successfully") 
                  ? "bg-green-100 text-green-700" 
                  : "bg-red-100 text-red-700"
              }`}>
                {message}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-4">
              <button 
                onClick={handleAddToCart}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium px-6 py-3 rounded-lg transition-colors"
              >
                {loading ? "Adding..." : "Add to Cart"}
              </button>
              <div className="flex items-center justify-between text-sm">
                <a href="#" className="text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  Or save for later?
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </a>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailProof}
                    onChange={(e) => setEmailProof(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Email Proof?</span>
                  <svg
                    className="w-4 h-4 text-gray-500 ml-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Tabs Section */}
        <div className="border-t border-gray-200 pt-8">
          {/* Tabs */}
          <div className="flex gap-6 mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab("description")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "description"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Description
            </button>
            <button
              onClick={() => setActiveTab("spec")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "spec"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Spec
            </button>
            <button
              onClick={() => setActiveTab("file-setup")}
              className={`pb-3 px-1 font-medium transition-colors ${
                activeTab === "file-setup"
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              File Setup
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === "description" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Next Day Turnaround and Cut-off Time:
                </h3>
                <p className="mb-2">
                  Order and submit artwork before 4pm PST ships next business day. Order after 4pm add 1 business day.
                </p>
                <p>Orders over 100 qty require 2 extra business days.</p>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Same Day Turnaround:</h3>
                <p>Order and submit artwork before 12pm PST ships same day.</p>
              </div>
              <div>
                <p>
                  Unstretched artist canvas in custom height and width so customers can order and frame photos and art at any size. Our canvas has semi-gloss finish, designed for long-term and fade-resistant fine art reproduction. The polyester/cotton blend canvas is great for superior color quality.
                </p>
              </div>
            </div>
          )}

          {activeTab === "spec" && (
            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Material:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>15 mil. white semigloss artist canvas</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Product Attributes:</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Custom sizes available. Maximum Size: 58" High X 100' Wide</li>
                  <li>Single sided only</li>
                  <li>Indoor use and UV safe</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === "file-setup" && (
            <div className="space-y-6 text-gray-700">
              <ul className="list-disc list-inside space-y-2">
                <li>Accepted File Formats: JPEG or PDF (single page only)</li>
                <li>Color Space: CMYK</li>
                <li>Resolution: 150dpi for raster images (More than enough for large format)</li>
                <li>Max File Upload Size: 300MB</li>
                <li>Submit artwork built to ordered size - Scaled artwork is automatically detected and fit to order</li>
                <li>Do not include crop marks or bleeds</li>
                <li>Do not submit with Pantones/Spot Colors - Convert to CMYK</li>
                <li>Convert live fonts to outlines</li>
                <li>Use provided design templates when available</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

