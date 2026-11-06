import { useState } from "react";
import { Building2 } from "lucide-react";
import { getPropertyImage } from "../data/images.js";

// Photo for a listing (or any `src`). Shows a quiet neutral block if the image can't load.
export default function PropertyImage({ property, src, alt, width = 1200, priority = false, className = "" }) {
  const url = src || getPropertyImage(property, width);
  const [failedUrl, setFailedUrl] = useState(null);

  if (!url || failedUrl === url) {
    return (
      <div role="img" aria-label={alt || property?.title || "Photo unavailable"} className="grid h-full w-full place-items-center bg-sand-200 text-sand-500">
        <Building2 className="h-8 w-8" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt ?? property?.title ?? ""}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailedUrl(url)}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
