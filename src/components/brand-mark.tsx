import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  decorative?: boolean;
  className?: string;
};

/** The external SVG keeps its gradient IDs isolated when this mark is repeated. */
export function BrandMark({ size = 36, decorative = false, className }: BrandMarkProps) {
  return <Image
    src="/brand/floww-mark.svg"
    width={size}
    height={Math.round(size * 449 / 384)}
    alt={decorative ? "" : "Floww"}
    aria-hidden={decorative || undefined}
    className={className}
    unoptimized
    style={{ display: "block", flex: "none" }}
  />;
}
