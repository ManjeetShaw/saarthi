import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function FormAlert({ message }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 p-3 bg-[#D90429]/10 border border-[#D90429]/20 rounded-xl text-xs text-[#D90429]">
      <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
      <span>{message}</span>
    </div>
  );
}
