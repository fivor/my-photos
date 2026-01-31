import React, { useState, useEffect, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isBefore, startOfDay, parseISO, getYear, setYear, setMonth, getMonth, subMonths, addMonths } from 'date-fns';
import { zhCN, enUS } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Photo } from '../types';
import { useConfig } from '../context/ConfigContext';

interface Props {
  photos: Photo[];
  currentDate: Date;
  onDateClick: (date: Date) => void;
}

type ViewMode = 'day' | 'month' | 'year';

export default function CalendarSidebar({ photos, currentDate, onDateClick }: Props) {
  const { language } = useConfig();
  const [viewDate, setViewDate] = useState(currentDate);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const locale = language === 'zh' ? zhCN : enUS;

  // Update view when external currentDate changes (only if in day mode to avoid jumping while selecting)
  useEffect(() => {
    if (viewMode === 'day') {
      setViewDate(currentDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]); // Remove viewMode dependency to prevent overriding user selection when switching modes

  // Calculate stats and ranges
  const { minDate, maxDate, daysWithPhotos, monthsWithPhotos, yearsWithPhotos } = useMemo(() => {
    const dates = photos.map(p => p.date ? parseISO(p.date) : parseISO(p.uploadedAt));
    const daySet = new Set(dates.map(d => format(d, 'yyyy-MM-dd')));
    const monthSet = new Set(dates.map(d => format(d, 'yyyy-MM')));
    const yearSet = new Set(dates.map(d => getYear(d)));
    
    if (dates.length === 0) {
      const now = new Date();
      return { 
        minDate: now, maxDate: now, 
        daysWithPhotos: daySet, monthsWithPhotos: monthSet, yearsWithPhotos: yearSet 
      };
    }

    const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
    return {
      minDate: sorted[0],
      maxDate: sorted[sorted.length - 1],
      daysWithPhotos: daySet,
      monthsWithPhotos: monthSet,
      yearsWithPhotos: yearSet
    };
  }, [photos]);

  // Smart Navigation Logic
  const handleSmartPrev = () => {
    if (viewMode === 'day') {
      // Find previous month with photos
      const currentMonthStr = format(viewDate, 'yyyy-MM');
      const sortedMonths = Array.from(monthsWithPhotos).sort().reverse(); // Descending
      const prevMonth = sortedMonths.find(m => m < currentMonthStr);
      
      if (prevMonth) {
        setViewDate(parseISO(`${prevMonth}-01`));
      } else {
        // Fallback to strict previous month if no photo month found (e.g. at start)
        // or just stay at start if strict limit
        const prev = subMonths(viewDate, 1);
        if (!isBefore(prev, startOfMonth(minDate))) {
           setViewDate(prev);
        }
      }
    } else if (viewMode === 'month') {
      setViewDate(setYear(viewDate, getYear(viewDate) - 1));
    } else {
      // Year mode: page through years? Maybe just scroll.
      // Let's keep arrows for Day/Month navigation mostly.
    }
  };

  const handleSmartNext = () => {
    if (viewMode === 'day') {
      // Find next month with photos
      const currentMonthStr = format(viewDate, 'yyyy-MM');
      const sortedMonths = Array.from(monthsWithPhotos).sort(); // Ascending
      const nextMonth = sortedMonths.find(m => m > currentMonthStr);
      
      if (nextMonth) {
        setViewDate(parseISO(`${nextMonth}-01`));
      } else {
        const next = addMonths(viewDate, 1);
        const effectiveMax = isAfter(new Date(), maxDate) ? new Date() : maxDate;
        if (!isAfter(next, endOfMonth(effectiveMax))) {
          setViewDate(next);
        }
      }
    } else if (viewMode === 'month') {
       setViewDate(setYear(viewDate, getYear(viewDate) + 1));
    }
  };

  // Determine availability for arrows
  const canGoPrev = useMemo(() => {
    if (viewMode === 'day') {
        const currentMonthStr = format(viewDate, 'yyyy-MM');
        // Check if there is any photo-month before current
        const hasOlderPhotos = Array.from(monthsWithPhotos).some(m => m < currentMonthStr);
        // Also allow going back to minDate even if no photos
        return hasOlderPhotos || isAfter(startOfMonth(viewDate), startOfMonth(minDate));
    }
    return getYear(viewDate) > getYear(minDate);
  }, [viewDate, minDate, monthsWithPhotos, viewMode]);

  const canGoNext = useMemo(() => {
    const effectiveMax = isAfter(new Date(), maxDate) ? new Date() : maxDate;
    if (viewMode === 'day') {
        const currentMonthStr = format(viewDate, 'yyyy-MM');
        const hasNewerPhotos = Array.from(monthsWithPhotos).some(m => m > currentMonthStr);
        return hasNewerPhotos || isBefore(startOfMonth(viewDate), startOfMonth(effectiveMax));
    }
    return getYear(viewDate) < getYear(effectiveMax);
  }, [viewDate, maxDate, monthsWithPhotos, viewMode]);


  // Headers
  const weekDays = language === 'zh' 
    ? ['日', '一', '二', '三', '四', '五', '六']
    : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Render Logic
  const renderHeader = () => {
    let title = '';
    if (viewMode === 'day') {
      // "2026年1月" (Chinese) or "January 2026"
      title = format(viewDate, language === 'zh' ? 'yyyy年M月' : 'MMMM yyyy', { locale });
    } else if (viewMode === 'month') {
      title = format(viewDate, 'yyyy');
    } else {
      title = `${getYear(minDate)} - ${getYear(maxDate)}`;
    }

    return (
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={handleSmartPrev} 
          disabled={!canGoPrev}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        
        <button 
          onClick={() => {
            if (viewMode === 'day') setViewMode('month');
            else if (viewMode === 'month') setViewMode('year');
          }}
          className="font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition-colors"
        >
          {title}
        </button>

        <button 
          onClick={handleSmartNext} 
          disabled={!canGoNext}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  };

  const renderDayView = () => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return (
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {weekDays.map(d => (
          <div key={d} className="text-gray-400 dark:text-gray-500 py-1 transition-colors font-medium">{d}</div>
        ))}
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasPhotos = daysWithPhotos.has(dateStr);
          const isSelected = isSameDay(day, currentDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={day.toISOString()}
              onClick={() => hasPhotos && onDateClick(day)}
              disabled={!hasPhotos}
              className={`
                aspect-square flex items-center justify-center rounded-full transition-all text-xs relative
                ${hasPhotos 
                  ? 'hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer text-gray-900 dark:text-white font-medium' 
                  : 'text-gray-300 dark:text-gray-600 cursor-default'}
                ${isSelected ? '!bg-blue-600 !text-white font-bold hover:!bg-blue-700 shadow-md' : ''}
                ${hasPhotos && !isSelected ? 'bg-gray-50 dark:bg-gray-700/50' : ''}
                ${isToday && !isSelected ? 'ring-1 ring-blue-400 dark:ring-blue-500' : ''}
              `}
            >
              {format(day, 'd')}
              {hasPhotos && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 bg-blue-500 rounded-full opacity-50"></div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }).map((_, i) => {
          const date = setMonth(viewDate, i);
          const monthStr = format(date, 'yyyy-MM');
          const hasPhotos = monthsWithPhotos.has(monthStr);
          const isCurrentMonth = i === getMonth(viewDate);
          
          return (
            <button
              key={i}
              onClick={() => {
                setViewDate(date);
                setViewMode('day');
              }}
              className={`
                p-2 rounded text-sm transition-colors
                ${hasPhotos ? 'font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600'}
                ${isCurrentMonth ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}
              `}
            >
              {format(date, 'MMM', { locale })}
            </button>
          );
        })}
      </div>
    );
  };

  const renderYearView = () => {
    const years = [];
    const startYear = getYear(minDate);
    const endYear = Math.max(getYear(maxDate), getYear(new Date())); // Ensure current year is included
    
    for (let y = startYear; y <= endYear; y++) {
      years.push(y);
    }

    return (
      <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
        {years.reverse().map(year => { // Show newest years first
          const hasPhotos = yearsWithPhotos.has(year);
          const isCurrentYear = year === getYear(viewDate);
          
          return (
            <button
              key={year}
              onClick={() => {
                setViewDate(setYear(viewDate, year));
                setViewMode('month');
              }}
              className={`
                p-2 rounded text-sm transition-colors
                ${hasPhotos ? 'font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700' : 'text-gray-300 dark:text-gray-600'}
                ${isCurrentYear ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''}
              `}
            >
              {year}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 sticky top-24 shadow-sm dark:shadow-none border border-gray-200 dark:border-gray-700 transition-colors duration-200">
      {renderHeader()}
      
      <div className="mt-2 min-h-[240px]">
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'month' && renderMonthView()}
        {viewMode === 'year' && renderYearView()}
      </div>
    </div>
  );
}