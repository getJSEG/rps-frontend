"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { getProductImageUrl } from "../../utils/api";
import "swiper/css";
import "swiper/css/navigation";

export type CarouselProduct = {
  id: string | number;
  name: string;
  image?: string;
  image_url?: string;
  is_new?: boolean;
};

type ProductCarouselProps = {
  products: CarouselProduct[];
};

export default function ProductCarousel({ products }: ProductCarouselProps) {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  if (!products.length) {
    return (
      <p className="text-sm text-gray-500 py-6 px-1">No products in this subcategory yet.</p>
    );
  }

  return (
    <div className="relative group/carousel">
      <Swiper
        modules={[Navigation]}
        slidesPerView={1.15}
        spaceBetween={16}
        breakpoints={{
          480: { slidesPerView: 1.5, spaceBetween: 16 },
          640: { slidesPerView: 2, spaceBetween: 16 },
          900: { slidesPerView: 3, spaceBetween: 20 },
          1200: { slidesPerView: 4, spaceBetween: 20 },
          1536: { slidesPerView: 5, spaceBetween: 20 },
        }}
        onInit={(swiper) => {
          if (swiper.params.navigation && typeof swiper.params.navigation !== "boolean") {
            swiper.params.navigation.prevEl = prevRef.current;
            swiper.params.navigation.nextEl = nextRef.current;
            swiper.navigation.init();
            swiper.navigation.update();
          }
        }}
        className="!pb-1"
      >
        {products.map((product) => {
          const rawUrl = product.image_url || product.image;
          const imageSrc = getProductImageUrl(rawUrl);
          const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
          const isNew = product.is_new;

          return (
            <SwiperSlide key={product.id} className="!h-auto">
              <Link href={`/products/product-detail?productId=${product.id}`} className="block h-full">
                <div className="group h-full flex flex-col border border-gray-200 bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-full aspect-[4/3] bg-gray-200 relative overflow-hidden">
                    {imageSrc ? (
                      isBackendUpload ? (
                        <img
                          src={imageSrc}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 45vw, (max-width: 900px) 30vw, 22vw"
                          unoptimized
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-200">
                        <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                        {product.name}
                      </h3>
                      {isNew && (
                        <span className="shrink-0 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </SwiperSlide>
          );
        })}
      </Swiper>
      <button
        ref={prevRef}
        type="button"
        aria-label="Previous products"
        className="absolute left-0 top-[42%] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md text-gray-700 hover:bg-gray-50 opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0 hidden sm:flex items-center justify-center -ml-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        ref={nextRef}
        type="button"
        aria-label="Next products"
        className="absolute right-0 top-[42%] -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white border border-gray-200 shadow-md text-gray-700 hover:bg-gray-50 opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0 hidden sm:flex items-center justify-center -mr-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
