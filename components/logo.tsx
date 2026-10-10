import Image from "next/image";

/** Logo Kemenkes RS Hasan Sadikin (ikon saja). */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return <Image src="/logo-rshs.png" alt="" width={239} height={256} className={`object-contain ${className}`} priority />;
}

/** Logo lengkap dengan tulisan "Kemenkes RS Hasan Sadikin". */
export function LogoLengkap({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <Image
      src="/logo-rshs-lengkap.png"
      alt="Kemenkes RS Hasan Sadikin"
      width={547}
      height={160}
      className={className}
      priority
    />
  );
}
