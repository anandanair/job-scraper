"use client";

import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();

  // Hide footer completely during setup
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    return null;
  }

  return (
    <footer className="flex-shrink-0 border-t border-gray-100 bg-white py-4 text-center text-xs text-gray-400">
      © {new Date().getFullYear()} JobTrack
    </footer>
  );
}
