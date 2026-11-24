import React from 'react';

export default function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="text-center py-14 px-6 bg-white rounded-2xl border border-dashed border-[#c1c8c2]">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-[#f3f4f5] text-[#717973] flex items-center justify-center mx-auto mb-4">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <p className="font-bold text-[#191c1d]">{title}</p>
      {message && <p className="text-sm text-[#717973] mt-1 max-w-sm mx-auto">{message}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
