"use client";

import Image from "next/image";

export default function Footer() {
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    // You could add a toast notification here
  };

  const handleGoTo = (address: string) => {
    const encodedAddress = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  const storePickups = [
    {
      name: "B2Sign Headquarters",
      address: "462 Humane Way, Pomona, CA 91766",
      hours: "8:00am - 5:00pm PST",
    },
    {
      name: "Sign Department",
      address: "1260 E Grand Ave, Pomona, CA 91766",
      hours: "8:30am - 5:30pm PST",
    },
    {
      name: "TX Print Facility",
      address: "3422 W Kingsley Rd, Garland, TX 75041",
      hours: "2:00pm - 4:30pm CST",
    },
    {
      name: "PA Print Facility",
      address: "9250 Ashton Rd, Philadelphia, PA 19114",
      hours: "2:00pm - 4:30pm EST",
    },
  ];

  const navigationLinks = [
    "About Us",
    "Contact Us",
    "Help Center",
    "Design Templates",
    "Request Sample Kit",
    "Holiday Schedule",
  ];

  return (
    <footer className="bg-[#444] text-white">
      {/* Yellow Top Border */}
      <div className="bg-[#f47b23] h-[6px]"></div>
      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Column 1: Store Pickup */}
          {/* <div>
            <h3 className="text-xl font-bold mb-6">Store Pickup</h3>
            <div className="space-y-6">
              {storePickups.map((store, index) => (
                <div key={index}>
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <h4 className="text-sm text-gray-300 mb-1">{store.name}</h4>
                      <p className="text-sm text-gray-300 mb-1">{store.address}</p>
                      <p className="text-sm text-gray-300">Pick Up Hours: {store.hours}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleCopyAddress(store.address)}
                        className="bg-[#656565] border border-gray-400 hover:bg-black text- px-2 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                      >
                        Copy Address
                      </button>
                      <button
                        onClick={() => handleGoTo(store.address)}
                        className="bg-[#656565] border border-gray-400 hover:bg-black  px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-between whitespace-nowrap w-full"
                      >
                        Go To
                        <Image
                          src="/google-map-icon.svg"
                          alt="Map icon"
                          width={16}
                          height={16}
                          className="w-4 h-4"
                        />
                      </button>
                    </div>
                  </div>
                  {index < storePickups.length - 1 && (
                    <div className="border-t border-dashed border-gray-400 mt-6"></div>
                  )}
                </div>
              ))}
            </div>
          </div> */}

          {/* Column 2: Contact */}
          <div>
            <h3 className="text-xl font-bold mb-6">Contact</h3>
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-300 mb-4">
                  Customer Service Office Hour:
                </p>
                <p className="text-sm text-gray-300 mb-4">
                  Mon - Fri: 8:00am - 5:00pm PST
                </p>
                <div className="border-t border-dashed border-gray-400"></div>
              </div>

              <div>
                <p className="text-sm text-gray-300 mb-3">Toll Free: 1(888)739-8501</p>
                <div className="flex gap-2">
                  <button className="bg-blue-400  hover:bg-black text-[#ffffff] px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                    Call
                  </button>
                  <button className="bg-[#656565] border border-gray-400 hover:bg-black  px-4 py-2 rounded-lg text-sm transition-colors">
                    Request Callback
                  </button>
                </div>
                <div className="border-t border-dashed border-gray-400 mt-6"></div>
              </div>

              <div>
                {/* <p className="text-sm text-gray-400 mb-4">
                  <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                  Live Chat: • Offline
                </p> */}
                {/* <div className="border-t border-dashed border-gray-400"></div> */}
              </div>

              <div>
                <p className="text-sm text-gray-400">Email: info@resourcefulDigital.com</p>
              </div>
            </div>
          </div>

          {/* Column 3: Share Your Thoughts & Product Catalog */}
          <div>
            {/* <div className="mb-8">
              <h3 className="text-xl font-bold mb-4">Share Your Thoughts</h3>
              <p className="text-sm text-gray-400 mb-4">
                We value your input. If you have suggestions or feedback, let us know. Your message is important to us.
              </p>
              <button className="bg-[#656565] border border-gray-400 hover:bg-black  px-6 py-2 rounded-lg text-sm transition-colors">
                Leave Feedback
              </button>
            </div> */}

            <div>
              <h3 className="text-xl font-bold mb-4">Product Catalog</h3>
              <div className="flex flex-col gap-2"> 
                <button className="w-1/2 bg-[#656565] border border-gray-400 hover:bg-black  py-2 rounded-lg text-sm transition-colors">
                  Download PDF
                </button>
                {/* <button className="w-1/2 bg-[#656565] border border-gray-400 hover:bg-black   py-2 rounded-lg text-sm transition-colors">
                  White Label Site
                </button> */}
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-4">
            {navigationLinks.map((link, index) => (
              <a
                key={index}
                href="#"
                className="text-[#767676] hover:text-gray-300 text-sm transition-colors"
              >
                {link}
              </a>
            ))}
          </div>
      </div>

      {/* Footer Bottom */}
      <div className="bg-[#222] border-t border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
         
        

          {/* Copyright and Terms */}
          <div className="text-center flex justify-center gap-4">
            <p className="text-sm text-gray-400 mb-2">
              Copyright © 2026-2027 Resourceful Print Solutions, Inc. All Rights Reserved.
            </p>
            <a
              href="#"
              className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
            >
              Terms & Conditions
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

