import { useEffect } from "react";

export default function useAllowBodyScroll() {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
}
