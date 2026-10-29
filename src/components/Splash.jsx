import { useEffect, useState } from "react";

const SPLASH_MOBILE = `${import.meta.env.BASE_URL}receipt_track_splash.png`;
const SPLASH_DESKTOP = `${import.meta.env.BASE_URL}receipt_track_splash_desktop.png`;

// Full-screen splash shown over the app on load: holds for 1.8s, then fades
// out over 0.6s (the .hiding animation in styles.css) and unmounts.
export function Splash() {
  const [isHiding, setIsHiding] = useState(false);
  const [isDone, setIsDone] = useState(false);
  useEffect(() => {
    const hideTimer = setTimeout(() => setIsHiding(true), 1800);
    const doneTimer = setTimeout(() => setIsDone(true), 2400);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, []);
  if (isDone) {
    return null;
  }
  const src = window.innerWidth < 768 ? SPLASH_MOBILE : SPLASH_DESKTOP;
  return (
    <div className={`splash-screen${isHiding ? " hiding" : ""}`}>
      <img src={src} alt="Receipt Tracker" />
    </div>
  );
}
