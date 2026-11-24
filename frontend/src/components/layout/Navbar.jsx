import React from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Menu, X } from 'lucide-react';
import { getInitials } from '../../utils/formatters.js';

export default function Navbar({ onMobileMenuToggle, isMobileMenuOpen, title, subtitle }) {
  const { user } = useAuth();

  return (
    <header className="w-full px-4 md:px-8 py-4 flex items-center justify-between z-20 shrink-0">
      {/* Page Title / Mobile menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 rounded-xl bg-white border border-[#e1e3e4] text-[#191c1d]"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div>
          {subtitle && <p className="text-xs font-medium text-[#717973]">{subtitle}</p>}
          <h2 className="text-xl md:text-2xl font-bold text-[#191c1d] tracking-tight">
            {title || 'Joineazy'}
          </h2>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* User Avatar */}
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-[#012d1d] text-white flex items-center justify-center text-xs font-bold">
            {getInitials(user?.name)}
          </div>
        </div>
      </div>
    </header>
  );
}
