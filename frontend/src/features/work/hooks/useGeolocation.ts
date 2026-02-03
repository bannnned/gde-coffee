import { useEffect, useState } from "react";

type LngLat = [number, number];

type GeoStatus = "idle" | "ok" | "unavailable" | "error";

export default function useGeolocation(initialCenter: LngLat) {
  const [userCenter, setUserCenter] = useState<LngLat>(initialCenter);
  const [focusLngLat, setFocusLngLat] = useState<LngLat | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(() =>
    "geolocation" in navigator ? "idle" : "unavailable",
  );

  function locateMe(forceFocus: boolean) {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: LngLat = [pos.coords.longitude, pos.coords.latitude];
        setUserCenter(next);
        if (forceFocus) setFocusLngLat(next);
        setGeoStatus("ok");
      },
      () => {
        setGeoStatus("error");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  useEffect(() => {
    locateMe(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { userCenter, focusLngLat, setFocusLngLat, locateMe, geoStatus };
}
