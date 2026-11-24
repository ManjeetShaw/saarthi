import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  LayoutGrid,
  Users,
  GraduationCap,
  FileText,
  BarChart3,
  LogOut,
  CheckSquare,
} from 'lucide-react';
import { getInitials } from '../../utils/formatters.js';

export default function Sidebar({ className = '' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';

  const studentLinks = [
    { label: 'Dashboard', path: '/student/dashboard', icon: LayoutGrid },
    { label: 'Assignments', path: '/student/assignments', icon: FileText },
    { label: 'Groups', path: '/student/groups', icon: Users },
  ];

  const adminLinks = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutGrid },
    { label: 'Assignments', path: '/admin/assignments', icon: FileText },
    { label: 'Submissions', path: '/admin/submissions', icon: CheckSquare },
    { label: 'Groups', path: '/admin/groups', icon: Users },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  ];

  const navLinks = isStudent ? studentLinks : adminLinks;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`hidden md:flex flex-col h-screen py-6 px-4 fixed left-0 top-0 w-64 lg:w-72 bg-white/80 dark:bg-[#f8f9fa] border-r border-[#e1e3e4] backdrop-blur-xl z-30 overflow-y-auto select-none ${className}`}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#012d1d] flex items-center justify-center text-white shadow-sm shrink-0">
          <GraduationCap className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-[#012d1d] tracking-tight leading-tight flex items-center gap-1.5">
            Joineazy
          </h1>
          <p className="text-[11px] font-medium text-[#717973] uppercase tracking-wider">
            {isAdmin ? 'Professor portal' : 'Student portal'}
          </p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col gap-1.5 overflow-y-auto pr-1">
        {navLinks.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-[#012d1d]/10 text-[#012d1d] font-semibold'
                    : 'text-[#414844] hover:bg-[#f3f4f5] hover:text-[#191c1d] hover:translate-x-0.5'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div className="mt-auto flex flex-col gap-3 pt-4 border-t border-[#e1e3e4]">
        <div className="flex flex-col gap-0.5">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs text-[#D90429] hover:bg-[#D90429]/10 transition-colors w-full text-left font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

        {/* User Card */}
        {user && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-[#f3f4f5]/60 border border-[#e1e3e4]/60">
            <div className="w-9 h-9 rounded-full bg-[#012d1d] text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {getInitials(user.name)}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-bold text-[#191c1d] truncate">
                {user.name}
              </span>
              <span className="text-[11px] text-[#717973] truncate">
                {user.role === 'admin' ? 'Professor' : 'Student'} {user.student_id ? `• ${user.student_id}` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
