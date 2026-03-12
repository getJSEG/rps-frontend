"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

interface MaterialProduct {
  id: string;
  name: string;
  dimensions?: string;
  price: string;
  image?: string;
  category: string;
}

export default function Material() {

  // Material products organized by category
  const materialProducts: MaterialProduct[] = [
    // Material category
    {
      id: "1",
      name: "3 Mil Calendered Lamination Film (Matte)",
      dimensions: "54\"x164'",
      price: "$163.90",
      category: "Material",
    },
    {
      id: "2",
      name: "4 Mil Calendered Vinyl (Matte)",
      dimensions: "54\" x 164'",
      price: "$163.90",
      category: "Material",
    },
    {
      id: "3",
      name: "15 Mil Polyester Canvas Fabric (Semi Gloss)",
      dimensions: "50\" x 164'",
      price: "$240.79",
      category: "Material",
    },
    // Tape category
    {
      id: "4",
      name: "PET Double Sided Tape / Red Tape - 2 Rolls",
      price: "$30.25",
      category: "Tape",
    },
    {
      id: "5",
      name: "Blue Masking Tape",
      dimensions: "0.8\" x 164'",
      price: "$3.63",
      category: "Tape",
    },
    {
      id: "6",
      name: "Double Sided Banner Tape",
      dimensions: "1\" x 164'",
      price: "$7.26",
      category: "Tape",
    },
    // Other Supply category
    {
      id: "7",
      name: "#2 Self Piercing Brass Grommets (Stimpson) - 500 set",
      price: "$53.90",
      category: "Other Supply",
    },
    {
      id: "8",
      name: "Aluminum Standoff Hardware",
      price: "$14.51",
      category: "Other Supply",
    },
  ];

  // Group products by category
  const materialCategoryProducts = materialProducts.filter(
    (product) => product.category === "Material"
  );
  const tapeCategoryProducts = materialProducts.filter(
    (product) => product.category === "Tape"
  );
  const otherSupplyProducts = materialProducts.filter(
    (product) => product.category === "Other Supply"
  );

  return (
    <section className="py-8 px-4 bg-white min-h-screen pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-8">
          {/* Sidebar - Left (Same as Products) */}
          <Sidebar />

          {/* Main Content - Right */}
          <div className="flex-1">
            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Material</h1>

            {/* Material Section */}
            <div className="mb-8">
              <div className="mb-4">
                <button className="px-4 py-2 bg-gray-200 text-gray-900 text-sm font-medium">
                  Material
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {materialCategoryProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white overflow-hidden"
                  >
                    {/* Product Image Placeholder */}
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center border border-gray-200">
                      <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded flex items-center justify-center relative">
                        <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-amber-700 rounded-b"></div>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="mt-3">
                      <h3 className="text-base font-medium text-blue-600 mb-1">
                        {product.name}
                      </h3>
                      {product.dimensions && (
                        <p className="text-sm text-blue-600 mb-1">{product.dimensions}</p>
                      )}
                      <p className="text-base font-semibold text-blue-600">{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tape Section */}
            <div className="mb-8">
              <div className="mb-4">
                <button className="px-4 py-2 text-gray-600 text-sm font-medium">
                  Tape
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tapeCategoryProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white overflow-hidden"
                  >
                    {/* Product Image Placeholder */}
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center border border-gray-200">
                      <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded flex items-center justify-center relative">
                        <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-amber-700 rounded-b"></div>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="mt-3">
                      <h3 className="text-base font-medium text-blue-600 mb-1">
                        {product.name}
                      </h3>
                      {product.dimensions && (
                        <p className="text-sm text-blue-600 mb-1">{product.dimensions}</p>
                      )}
                      <p className="text-base font-semibold text-blue-600">{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Other Supply Section */}
            <div className="mb-8">
              <div className="mb-4">
                <button className="px-4 py-2 text-gray-600 text-sm font-medium">
                  Other Supply
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {otherSupplyProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white overflow-hidden"
                  >
                    {/* Product Image Placeholder */}
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center border border-gray-200">
                      <div className="w-32 h-32 bg-white border-2 border-gray-300 rounded flex items-center justify-center relative">
                        <div className="w-20 h-20 bg-gray-200 rounded-full"></div>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-amber-700 rounded-b"></div>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="mt-3">
                      <h3 className="text-base font-medium text-blue-600 mb-1">
                        {product.name}
                      </h3>
                      {product.dimensions && (
                        <p className="text-sm text-blue-600 mb-1">{product.dimensions}</p>
                      )}
                      <p className="text-base font-semibold text-blue-600">{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

