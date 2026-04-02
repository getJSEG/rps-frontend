import Image from "next/image";
import Link from "next/link";

export default function ShippingBanner() {
  return (
    <section className="bg-white py-12 px-4">
      <div className=" mx-auto">
        {/* Top Text Area */}
        <div className="text-center mb-8">
          <p className="text-gray-700 text-lg md:text-xl mb-2">
            Orders placed by 4pm PST will be shipped the next business day
          </p>
          
        </div>

        {/* Banner Graphic Section */}
        <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden h-96 md:h-[500px]">
          <Image
            src="/oUhg0Opf.PNG"
            alt="Shipping banner"
            fill
            priority
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
          />

          {/* Call to Action Button (on image) */}
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Link
              href="/products"
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg px-8 py-2 rounded-sm shadow-lg transition-colors transform hover:scale-105"
            >
              SHOP ALL BANNERS
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

