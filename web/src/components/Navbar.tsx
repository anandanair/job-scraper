"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  Home,
  Star,
  Zap,
  CheckSquare,
  Menu,
  X,
  Sparkles,
  Settings,
} from "lucide-react";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const pathname = usePathname();

  // Hide Navbar completely during setup
  if (pathname === "/setup" || pathname.startsWith("/setup/")) {
    return null;
  }

  // Handle scroll effect for navbar backdrop
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (isMenuOpen && !target.closest(".mobile-menu-container")) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMenuOpen]);

  const navItems = [
    { href: "/", icon: <Home size={18} />, text: "Home" },
    { href: "/jobs/top-matches", icon: <Star size={18} />, text: "Matches" },
    { href: "/jobs/new", icon: <Zap size={18} />, text: "New" },
    { href: "/jobs/applied", icon: <CheckSquare size={18} />, text: "Applied" },
    { href: "/resume-studio", icon: <Sparkles size={18} />, text: "Resume Studio" },
    { href: "/settings", icon: <Settings size={18} />, text: "Settings" },
  ];

  const isItemActive = (href: string) => {
    if (href === "/resume-studio") {
      return (
        pathname.startsWith("/resume-studio") ||
        pathname === "/profile" ||
        pathname === "/resume-style"
      );
    }
    if (href === "/settings") {
      return pathname.startsWith("/settings");
    }
    return pathname === href;
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-b border-gray-200/80"
            : "bg-white border-b border-gray-100"
        }`}
      >
        <div className="container mx-auto px-4 max-w-6xl">
          <nav className="flex justify-between items-center h-16">
            {/* Minimalist Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 group"
              onClick={() => setIsMenuOpen(false)}
            >
              <div className="p-1.5 rounded-lg bg-slate-900 group-hover:bg-slate-800 transition-colors">
                <Briefcase className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-gray-900">
                JobTrack
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  text={item.text}
                  isActive={isItemActive(item.href)}
                />
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 mobile-menu-container"
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 text-gray-700" />
              ) : (
                <Menu className="h-5 w-5 text-gray-700" />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/10 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Mobile Navigation Menu */}
      <div
        className={`md:hidden fixed top-16 left-0 right-0 z-50 mobile-menu-container transform transition-all duration-200 ease-out ${
          isMenuOpen
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0 pointer-events-none"
        }`}
      >
        <div className="mx-4 mt-2 bg-white rounded-xl shadow-lg border border-gray-100">
          <div className="py-2">
            {navItems.map((item) => (
              <MobileNavItem
                key={item.href}
                href={item.href}
                icon={item.icon}
                text={item.text}
                isActive={isItemActive(item.href)}
                onClick={() => setIsMenuOpen(false)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Spacer to prevent content from hiding behind fixed navbar */}
      <div className="h-16 flex-shrink-0" />
    </>
  );
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  text: string;
  isActive?: boolean;
  onClick?: () => void;
}

// Clean Desktop Navigation Item
function NavItem({ href, icon, text, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`relative px-3 py-2 rounded-lg flex items-center text-sm font-medium transition-all duration-200 ${
        isActive
          ? "text-slate-900 bg-slate-100"
          : "text-gray-600 hover:text-slate-900 hover:bg-gray-50"
      }`}
    >
      <span className="mr-2">{icon}</span>
      <span>{text}</span>

      {/* Subtle active indicator */}
      {isActive && (
        <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-slate-900 rounded-full" />
      )}
    </Link>
  );
}

// Clean Mobile Navigation Item
function MobileNavItem({ href, icon, text, isActive, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`flex items-center px-4 py-3 mx-2 rounded-lg transition-colors ${
        isActive
          ? "text-slate-900 bg-slate-50"
          : "text-gray-700 hover:bg-gray-50"
      }`}
      onClick={onClick}
    >
      <span className="mr-3">{icon}</span>
      <span className="font-medium">{text}</span>
    </Link>
  );
}
