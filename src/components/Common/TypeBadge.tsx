import React from 'react';
import { 
  Hash, 
  Type, 
  Calendar, 
  Braces, 
  Binary, 
  Tag, 
  Sliders
} from 'lucide-react';
import { getTypeCategory, CATEGORY_THEMES, TypeCategory } from '../../utils/dataTypeUtils';

interface TypeBadgeProps {
  typeStr: string;
  length?: string;
  showLength?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

export const TypeBadge: React.FC<TypeBadgeProps> = ({
  typeStr,
  length,
  showLength = true,
  size = 'sm',
  className = ''
}) => {
  const category = getTypeCategory(typeStr);
  const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES.other;

  // Extract base type name and embedded length if any
  let baseType = typeStr.trim().toUpperCase();
  let extractedLength = length;

  const parenMatch = baseType.match(/^([A-Z0-9_]+)\(([^)]+)\)/);
  if (parenMatch) {
    baseType = parenMatch[1];
    if (!extractedLength) {
      extractedLength = parenMatch[2];
    }
  }

  // Strip UNSIGNED or ZEROFILL for the clean type title
  const cleanType = baseType.replace(/\s+UNSIGNED|\s+ZEROFILL/g, '').trim();

  const renderIcon = () => {
    const iconClass = size === 'xs' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
    switch (category) {
      case 'numeric':
        return <Hash className={`${iconClass} shrink-0 opacity-80`} />;
      case 'decimal':
        return <span className="font-mono font-bold text-[10px] leading-none shrink-0 opacity-80">0.0</span>;
      case 'text':
        return <Type className={`${iconClass} shrink-0 opacity-80`} />;
      case 'datetime':
        return <Calendar className={`${iconClass} shrink-0 opacity-80`} />;
      case 'json':
        return <Braces className={`${iconClass} shrink-0 opacity-80`} />;
      case 'binary':
        return <Binary className={`${iconClass} shrink-0 opacity-80`} />;
      case 'enum':
        return <Tag className={`${iconClass} shrink-0 opacity-80`} />;
      default:
        return <Sliders className={`${iconClass} shrink-0 opacity-80`} />;
    }
  };

  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-[10px] gap-1',
    sm: 'px-2 py-0.5 text-[11px] gap-1.5',
    md: 'px-2.5 py-1 text-xs gap-2'
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded border ${theme.badgeBg} ${theme.badgeBorder} ${theme.badgeText} ${sizeClasses} select-none ${className}`}
      title={`${theme.label}: ${typeStr}`}
    >
      {renderIcon()}
      <span className="font-semibold tracking-wide">{cleanType}</span>
      {showLength && extractedLength && (
        <span className="opacity-75 font-normal">({extractedLength})</span>
      )}
    </span>
  );
};
