import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
}

export const EmptyState = ({ icon, title, description, actionLabel, actionLink }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-dashed border-gray-200 animate-in fade-in zoom-in duration-500">
      <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 mb-6 group-hover:scale-110 transition-transform">
        <Icon icon={icon} fontSize={40} />
      </div>
      <h3 className="text-xl font-bold text-[#212B36] mb-2">{title}</h3>
      <p className="text-gray-500 text-sm max-w-[280px] leading-relaxed mb-8">
        {description}
      </p>
      {actionLabel && actionLink && (
        <Link 
          to={actionLink} 
          className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-2"
        >
          <Icon icon="solar:add-circle-bold" fontSize={18} />
          {actionLabel}
        </Link>
      )}
    </div>
  );
};
