import { useEffect, useState } from "react";

type LngLat = [number, number];

type GeoStatus = "idle" | "loading" | "ok" | "unavailable" | "error";

export default function useGeolocation(initialCenter: LngLat) {
  const [userCenter, setUserCenter] = useState<LngLat>(initialCenter);
  const [focusLngLat, setFocusLngLat] = useState<LngLat | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(() =>
    "geolocation" in navigator ? "idle" : "unavailable",
  );
  const [isLocating, setIsLocating] = useState(false);

  function locateMe(forceFocus: boolean, showLoading = true) {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      setIsLocating(false);
      return;
    }

    if (showLoading) {
      setGeoStatus("loading");
      setIsLocating(true);
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setUserCenter(next);
        if (forceFocus) setFocusLngLat(next);
        setGeoStatus("ok");
        setIsLocating(false);
      },
      () => {
        setGeoStatus("error");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    locateMe(false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    userCenter,
    focusLngLat,
    setFocusLngLat,
    locateMe,
    geoStatus,
    isLocating,
  };
}
