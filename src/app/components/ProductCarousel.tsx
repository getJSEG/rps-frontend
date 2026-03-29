"use client";

import { useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import type { Swiper as SwiperClass } from "swiper/types";
import { getProductImageUrl } from "../../utils/api";
import "swiper/css";
import "swiper/css/navigation";

export type CarouselProduct = {
  id: string | number;
  name: string;
  image?: string;
  image_url?: string;
  /** Subcategory label (e.g. section name on category hub); shown first when set */
  subcategory?: string;
  category_name?: string;
  category?: string;
  description?: string | null;
  price?: string | number | null;
  price_per_sqft?: number | string | null;
};

function descriptionPreview(html: string | null | undefined): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseProductMoney(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const n = parseFloat(String(value).trim().replace(/[$,\s]/g, ""));
  return Number.isNaN(n) ? null : n;
}

type ProductCarouselProps = {
  products: CarouselProduct[];
};

export default function ProductCarousel({ products }: ProductCarouselProps) {
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const swiperRef = useRef<SwiperClass | null>(null);

  const bindNavigation = useCallback(() => {
    const swiper = swiperRef.current;
    if (!swiper || !prevRef.current || !nextRef.current) return;
    const nav = swiper.params.navigation;
    if (typeof nav === "object" && nav != null) {
      nav.prevEl = prevRef.current;
      nav.nextEl = nextRef.current;
    }
    if (swiper.navigation) {
      swiper.navigation.destroy();
      swiper.navigation.init();
      swiper.navigation.update();
    }
  }, []);

  useEffect(() => {
    bindNavigation();
  }, [products, bindNavigation]);

  if (!products.length) {
    return (
      <p className="text-sm text-gray-500 py-6 px-1">No products in this subcategory yet.</p>
    );
  }

  return (
    <div className="relative w-full min-w-0 overflow-hidden group/carousel">
      {/* Buttons must mount before Swiper so refs exist when navigation binds (onSwiper / onInit). */}
      <button
        ref={prevRef}
        type="button"
        aria-label="Previous products"
        className="absolute left-2 top-[42%] z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-35 sm:flex"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        ref={nextRef}
        type="button"
        aria-label="Next products"
        className="absolute right-2 top-[42%] z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-35 sm:flex"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
      <Swiper
        modules={[Navigation]}
        slidesPerView={1.15}
        spaceBetween={16}
        watchOverflow
        observer
        observeParents
        breakpoints={{
          480: { slidesPerView: 1.5, spaceBetween: 16 },
          640: { slidesPerView: 2, spaceBetween: 16 },
          900: { slidesPerView: 3, spaceBetween: 20 },
          1200: { slidesPerView: 4, spaceBetween: 20 },
          1536: { slidesPerView: 5, spaceBetween: 20 },
        }}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
          queueMicrotask(() => bindNavigation());
        }}
        onBeforeInit={(swiper) => {
          const nav = swiper.params.navigation;
          if (typeof nav === "object" && nav != null && prevRef.current && nextRef.current) {
            nav.prevEl = prevRef.current;
            nav.nextEl = nextRef.current;
          }
        }}
        className="!pb-1"
      >
        {products.map((product) => {
          const rawUrl = product.image_url || product.image;
          const imageSrc = getProductImageUrl(rawUrl);
          const isBackendUpload = rawUrl && String(rawUrl).trim().startsWith("/uploads/");
          const topLabel =
            product.subcategory?.trim() || product.category_name?.trim() || product.category?.trim() || "";
          const descPlain = descriptionPreview(product.description);
          const unit = parseProductMoney(product.price);
          const ppsf = parseProductMoney(product.price_per_sqft ?? undefined);

          return (
            <SwiperSlide key={product.id} className="!h-auto">
              <Link href={`/products/product-detail?productId=${product.id}`} className="block h-full">
                <div className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-md transition-all hover:border-gray-300 hover:shadow-lg">
                  <div className="relative h-40 w-full overflow-hidden bg-gray-200">
                    {imageSrc ? (
                      isBackendUpload ? (
                        <img
                          src={imageSrc}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <Image
                          src={imageSrc}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 640px) 45vw, (max-width: 900px) 30vw, 22vw"
                          unoptimized
                        />
                      )
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-200">
                        <svg className="h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
                    <div className="min-w-0">
                      {topLabel ? (
                        <p className="mb-1 line-clamp-1 text-xs text-gray-500">{topLabel}</p>
                      ) : null}
                      <h3 className="line-clamp-2 text-base font-semibold text-gray-900 transition-colors group-hover:text-blue-600 sm:text-lg">
                        {product.name}
                      </h3>
                    </div>
                    {descPlain ? (
                      <p className="line-clamp-3 min-w-0 break-words text-sm text-gray-600 [overflow-wrap:anywhere]">
                        {descPlain}
                      </p>
                    ) : null}
                    {unit != null ? (
                      <p className="text-base font-bold text-gray-900 sm:text-lg">${unit.toFixed(2)}</p>
                    ) : ppsf != null ? (
                      <p className="text-sm text-gray-700">${ppsf.toFixed(2)}/ft²</p>
                    ) : (
                      <p className="text-sm text-gray-700">Price on request</p>
                    )}
                  </div>
                </div>
              </Link>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </div>
  );
}
