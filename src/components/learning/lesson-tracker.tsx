"use client";

import { useEffect, useRef } from "react";
import { lessonHeartbeat, recordLessonView } from "@/app/actions/learning";

/** Записва отварянето на урока и реално прекараното време (само докато табът е видим). */
export function LessonTracker({ lessonId, mode }: { lessonId: string; mode: "understand" | "learn" | "practice" }) {
  const acc = useRef(0);
  const last = useRef<number | null>(null);

  useEffect(() => {
    recordLessonView(lessonId, mode).catch(() => {});
  }, [lessonId, mode]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && last.current) acc.current += (Date.now() - last.current) / 1000;
      last.current = document.visibilityState === "visible" ? Date.now() : null;
    };
    const flush = () => {
      tick();
      const sec = Math.floor(acc.current);
      if (sec >= 5) {
        acc.current -= sec;
        lessonHeartbeat(lessonId, sec, false).catch(() => {});
      }
    };
    last.current = document.visibilityState === "visible" ? Date.now() : null;
    const id = window.setInterval(flush, 60_000);
    const onVis = () => (document.visibilityState === "hidden" ? flush() : tick());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, [lessonId]);

  return null;
}
