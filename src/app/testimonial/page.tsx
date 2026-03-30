"use client";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Image from "next/image";

export default function TestimonialPage() {
  const testimonials = [
    {
      id: 1,
      name: "John Smith",
      company: "ABC Sign Company",
      role: "Owner",
      image: "/downloadman.png",
      rating: 5,
      text: "Outstanding quality and service! The team at Elmer E-commerce delivered our custom banners exactly as specified, and the turnaround time was impressive. Highly recommend for any signage needs.",
      date: "January 2024"
    },
    {
      id: 2,
      name: "Sarah Johnson",
      company: "Event Solutions Inc.",
      role: "Event Coordinator",
      image: "/downloadman.png",
      rating: 5,
      text: "We've been using Elmer for all our trade show displays and event tents. The quality is consistently excellent, and their customer service team is always helpful and responsive. They've become our go-to partner for all large format printing needs.",
      date: "December 2023"
    },
    {
      id: 3,
      name: "Michael Chen",
      company: "Retail Graphics Pro",
      role: "Creative Director",
      image: "/downloadman.png",
      rating: 5,
      text: "The print quality on our wall murals exceeded expectations. The colors are vibrant, and the material is durable. Our clients are always impressed with the final results. Great value for the price!",
      date: "November 2023"
    },
    {
      id: 4,
      name: "Emily Rodriguez",
      company: "Marketing Masters",
      role: "Marketing Manager",
      image: "/downloadman.png",
      rating: 5,
      text: "Fast shipping and excellent quality! We needed urgent banner printing for a last-minute campaign, and Elmer delivered on time without compromising quality. The team really understands the importance of deadlines.",
      date: "October 2023"
    },
    {
      id: 5,
      name: "David Thompson",
      company: "Sign Express",
      role: "Operations Manager",
      image: "/downloadman.png",
      rating: 5,
      text: "As a long-time customer, I appreciate the competitive pricing and reliable service. Elmer has helped our business grow by providing high-quality products that our own clients love. The online ordering system is also very user-friendly.",
      date: "September 2023"
    },
    {
      id: 6,
      name: "Lisa Anderson",
      company: "Corporate Events Plus",
      role: "Project Manager",
      image: "/downloadman.png",
      rating: 5,
      text: "We've ordered hundreds of custom event tents and displays from Elmer. Every order has been perfect - from the initial quote to final delivery. Their attention to detail and commitment to quality is unmatched in the industry.",
      date: "August 2023"
    }
  ];

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-white pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Customer Testimonials</h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              See what our customers have to say about their experience with Elmer E-commerce. 
              We're proud to serve thousands of satisfied clients across the country.
            </p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {testimonials.map((testimonial) => (
              <div
                key={testimonial.id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Rating */}
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <svg
                      key={i}
                      className="w-5 h-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                {/* Testimonial Text */}
                <p className="text-gray-700 mb-6 leading-relaxed">
                  "{testimonial.text}"
                </p>

                {/* Customer Info */}
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                    {testimonial.image ? (
                      <Image
                        src={testimonial.image}
                        alt={testimonial.name}
                        width={48}
                        height={48}
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-b from-gray-300 to-gray-500 flex items-center justify-center text-white font-semibold">
                        {testimonial.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                    <p className="text-sm text-gray-500">{testimonial.company}</p>
                    <p className="text-xs text-gray-400 mt-1">{testimonial.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Call to Action */}
          <div className="mt-16 text-center bg-blue-50 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to Experience Our Quality?
            </h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Join thousands of satisfied customers who trust Elmer E-commerce for their printing and signage needs.
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="/products"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-lg transition-colors"
              >
                Browse Products
              </a>
              <a
                href="/register"
                className="bg-white hover:bg-gray-50 text-blue-600 font-medium px-8 py-3 rounded-lg border-2 border-blue-600 transition-colors"
              >
                Create an account
              </a>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

