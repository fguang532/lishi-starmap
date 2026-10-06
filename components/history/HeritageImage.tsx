"use client";
import { useRef, useState } from "react";
import { Expand, ExternalLink, ImageOff, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { HistoricalImage } from "@/data/types";

export function ArtImage({
  image,
  className = "",
  eager = false,
}: {
  image: HistoricalImage;
  className?: string;
  eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (failedSource === image.localSrc)
    return (
      <span className={`image-missing ${className}`}>
        <ImageOff size={22} />
        图像暂不可用
      </span>
    );
  return (
    <img
      className={className}
      src={image.localSrc}
      alt={image.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailedSource(image.localSrc)}
    />
  );
}
export function ImageCredit({ image }: { image: HistoricalImage }) {
  const licenseUrl = image.license.match(/https:\/\/[^\s；）]+/)?.[0];
  return (
    <div className="image-credit">
      <p>{image.credit}</p>
      <p>{image.license.split("（")[0]} · 展示缩略图可能裁切，原图未改动</p>
      <div>
        <a href={image.sourceUrl} target="_blank" rel="noreferrer">
          馆藏与图像来源 <ExternalLink size={12} />
        </a>
        {licenseUrl && (
          <a href={licenseUrl} target="_blank" rel="noreferrer">
            许可说明 <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}
export default function HeritageImage({
  image,
  context = false,
  open,
  onOpenChange: setOpen,
}: {
  image: HistoricalImage;
  context?: boolean;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <figure className="heritage-figure">
        <button
          ref={trigger}
          className="heritage-image-button"
          onClick={() => setOpen(true)}
          aria-label={`放大图像：${image.title}`}
        >
          <ArtImage image={image} />
          <span>
            <Expand size={15} />
            查看全图
          </span>
        </button>
        <figcaption>
          <span className="figure-overline">
            {context ? "本时期图像参考" : "文物与图像"}
          </span>
          <strong>{image.title}</strong>
          <small>{image.dating}</small>
          <details>
            <summary>图像说明与授权</summary>
            <p>{image.caption}</p>
            <ImageCredit image={image} />
          </details>
        </figcaption>
      </figure>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="art-lightbox"
          showCloseButton={false}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus({ preventScroll: true });
          }}
        >
          <button
            className="lightbox-close panel-icon"
            onClick={() => setOpen(false)}
            aria-label="关闭全图"
          >
            <X size={20} />
          </button>
          <DialogTitle>{image.title}</DialogTitle>
          <DialogDescription>{image.dating}</DialogDescription>
          <div className="lightbox-scroll">
            <ArtImage image={image} eager />
            <p>{image.caption}</p>
            <ImageCredit image={image} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
