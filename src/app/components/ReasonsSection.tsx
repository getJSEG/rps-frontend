import Image from "next/image";

export default function ReasonsSection() {
  const features = [
    {
      icon: (
        <Image
          src="/download1.png"
          alt="Fast Turnaround"
          width={100}
          height={50}
          className="w-10 h-9"
        />
      ),
      title: "Fast Turnaround",
      description: "Orders placed by 4pm PST ship next business day, same-day options also available."
    },
    {
      icon: (
        <Image
          src="/download3-icon.png"
          alt="Fast Delivery"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Fast Delivery",
      description: "Shipping from 4 locations - California (2), Texas, and Pennsylvania - to ensure quicker product arrival."
    },
    {
      icon: (
        <Image
          src="/download.png"
          alt="Quality - Durst Printers"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Quality - Durst Printers",
      description: "Setting the standard in large format printing, we boast the largest fleet of Durst printers in the US."
    },
    {
      icon: (
        <Image
          src="/download2-icon.png"
          alt="Trusted by Professionals"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Trusted by Professionals",
      description: "Join thousands of customers who trust our decade-plus experience. We shipped over 2 million jobs in 2023."
    },
    {
      icon: (
        <Image
          src="/download4-icon.png"
          alt="Unmatched Capacity"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Unmatched Capacity",
      description: "Over 500,000 sq ft of production space and 400 staff operating 24 hrs/day cater to all project needs."
    },
    {
      icon: (
        <Image
          src="/download5-icon.png"
          alt="Low Price Guarantee"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Low Price Guarantee",
      description: "Our prices aren't just low; they're unbelievably low, with uncompromised quality."
    },
    {
      icon: (
        <Image
          src="/download7-icon.png"
          alt="Easy Online Ordering"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Easy Online Ordering",
      description: "Instant quotes, dropshipping, order tracking and group shipping to significantly reduce your costs."
    },
    {
      icon: (
        <Image
          src="/downloadman.png"
          alt="Superb Customer Support"
          width={100}
          height={40}
         className="w-10 h-9"
        />
      ),
      title: "Superb Customer Support",
      description: "Calls are answered on average in 1 minute, and emails within 30 minutes."
    }
  ];

  return (
    <section className="bg-gray-100 py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className=" text-center mb-12 text-gray-900" style={{ fontSize: '24px', fontFamily: 'Roboto, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
          Reasons to partner with us!
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="flex flex-col items-center text-center">
              <div className=" mb-4">
                {feature.icon}
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-[13px] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

