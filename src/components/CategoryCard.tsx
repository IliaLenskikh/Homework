import React from 'react';

interface CategoryCardProps {
  title: string;
  subtitle: string;
  count?: number;
  onClick: () => void;
  colorClass: string;
  icon: React.ReactNode;
  delay: number;
  badge?: string;
  stats?: { completed: number; total: number };
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ title, subtitle, count, onClick, colorClass, icon, delay, badge, stats }) => {
  let iconBgColor = 'bg-gray-100 text-gray-600';
  if (colorClass.includes('indigo')) iconBgColor = 'bg-indigo-100 text-indigo-600';
  if (colorClass.includes('teal')) iconBgColor = 'bg-teal-100 text-teal-600';
  if (colorClass.includes('amber')) iconBgColor = 'bg-amber-100 text-amber-600';
  if (colorClass.includes('rose')) iconBgColor = 'bg-rose-100 text-rose-600';
  if (colorClass.includes('purple')) iconBgColor = 'bg-purple-100 text-purple-600';
  if (colorClass.includes('blue')) iconBgColor = 'bg-blue-100 text-blue-600';
  if (colorClass.includes('cyan')) iconBgColor = 'bg-cyan-100 text-cyan-600';
  if (colorClass.includes('orange')) iconBgColor = 'bg-orange-100 text-orange-600';

  return (
    <div 
      onClick={onClick}
      className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer border border-slate-100 flex flex-col items-start gap-4 h-full group relative"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-4 right-4 flex items-center gap-2">
          {stats && (
              <div className="bg-white border border-slate-200 text-slate-500 text-xs font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${stats.completed === stats.total && stats.total > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  {stats.completed}/{stats.total}
              </div>
          )}
          {badge && (
            <div className="bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce shadow-sm">
              {badge}
            </div>
          )}
      </div>

      <div className={`p-4 rounded-2xl ${iconBgColor} transition-transform group-hover:scale-110`}>
          {icon}
      </div>
      
      <div>
          <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{title}</h3>
          <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
};
