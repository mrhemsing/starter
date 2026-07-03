import type { Metadata } from "next";
import { NotFoundCard } from "@/components/not-found-card";

export const metadata: Metadata = {
  title: "Page not found",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return <NotFoundCard />;
}
