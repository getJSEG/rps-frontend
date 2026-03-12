import Image from "next/image";

export default function FacilitiesBanner() {
  return (
    <section className="relative w-screen h-64 md:h-[400px] overflow-hidden">
      <Image
        src="/tvbBzlbS.jpg"
        alt="Facility"
        fill
        priority
        className="object-cover"
        sizes="100vw"
      />
    </section>
  );
}