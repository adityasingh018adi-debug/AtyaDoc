"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search, Crown, HelpCircle, Bell, Home, LogIn } from "lucide-react";

interface TopNavProps {
  onMenuClick: () => void;
}

export function TopNav({ onMenuClick }: TopNavProps) {
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header className="sticky top-0 z-30 w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
      <div className="flex items-center h-14 px-4 gap-4">
        {/* Left: hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            aria-label="Open menu"
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            <Menu size={20} />
          </button>
          <Link
            href="/"
            className="hidden md:flex items-center gap-2 md:hidden"
          >
            <span className="text-lg font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              AtyaDoc
            </span>
          </Link>
        </div>

        {/* Center: search */}
        <div className="flex-1 max-w-md mx-auto">
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all duration-200 ${
              searchFocused
                ? "border-blue-500 bg-white dark:bg-slate-800 shadow-sm shadow-blue-100"
                : "border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800"
            }`}
          >
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              type="text"
              aria-label="Search tools and documents"
              placeholder="Search tools, documents..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex-1 bg-transparent text-sm outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
            />
            <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono border border-slate-200 dark:border-slate-600 rounded text-slate-400 bg-white dark:bg-slate-700">
              ⌘K
            </kbd>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            href="/"
            aria-label="Home"
            className="hidden sm:flex p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800 text-slate-500 dark:text-slate-400"
          >
            <Home size={18} />
          </Link>

          <Link
            href="/login"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-lg transition-colors duration-200"
          >
            <LogIn size={13} />
            Login
          </Link>

          <Link
            href="/upgrade"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-black text-xs font-bold rounded-lg transition-colors duration-200"
          >
            <Crown size={13} />
            Upgrade to Pro
          </Link>

          <button aria-label="Help" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800 text-slate-500 dark:text-slate-400 hidden sm:flex">
            <HelpCircle size={18} />
          </button>

          <button aria-label="Notifications" className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 active:bg-slate-100 dark:active:bg-slate-800 text-slate-500 dark:text-slate-400">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <div aria-label="User account" className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold cursor-pointer shrink-0">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
