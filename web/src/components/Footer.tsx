"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Hide footer completely during setup
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    return null;
  }

  return (
    <footer className="flex-shrink-0 bg-gray-200 p-4 text-center text-sm text-gray-600">
      © {new Date().getFullYear()} Job App Tracker
    </footer>
  );
}
