import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';

interface Props {
  searchQuery: string;
}

export const SearchEasterEgg: React.FC<Props> = ({ searchQuery }) => {
  useEffect(() => {
    const keywords = ['love', '520', '情人节', '我爱你'];
    if (keywords.some(k => searchQuery.toLowerCase().includes(k))) {
       // Custom Heart Shape
       const heart = confetti.shapeFromPath({
         path: 'M167 102.7c-22.9-29-54.8-41.9-84.6-34.4C30.6 86.8 0 137.9 0 197.6c0 52.8 26.3 113.3 98.4 179.6C163.7 436.3 226.7 480 226.7 480l13.3 9.1 13.3-9.1s63-43.7 128.3-102.8C453.7 310.9 480 250.4 480 197.6c0-59.7-30.6-110.8-82.4-129.3-29.8-7.5-61.7 5.4-84.6 34.4l-31 39.4-31-39.4z'
       });

       const duration = 3000;
       const end = Date.now() + duration;

       (function frame() {
         const common = {
            shapes: [heart],
            colors: ['#ff69b4', '#ff1493', '#ff0000'],
            scalar: 2,
            ticks: 300,
            zIndex: 9999
         };

         confetti({ ...common, particleCount: 3, angle: 60, spread: 55, origin: { x: 0 } });
         confetti({ ...common, particleCount: 3, angle: 120, spread: 55, origin: { x: 1 } });
         confetti({ ...common, particleCount: 3, angle: 90, spread: 100, origin: { x: 0.3, y: -0.1 }, gravity: 0.8 });
         confetti({ ...common, particleCount: 3, angle: 90, spread: 100, origin: { x: 0.7, y: -0.1 }, gravity: 0.8 });

         if (Date.now() < end) {
           requestAnimationFrame(frame);
         }
       }());
    }
  }, [searchQuery]);

  return null;
};

export const Slogan: React.FC = () => {
  const [sloganText, setSloganText] = useState("-拾光为念，相纸凝成诗行，岁月留芳-");

  const handleSloganClick = (e: React.MouseEvent) => {
     const loveQuotes = [
        "斯人若彩虹，遇上方知有",
        "众生皆苦，你是草莓味",
        "山河远阔，人间烟火",
        "愿得一心人，白首不相离",
        "入目无别人，四下皆是你",
        "所爱隔山海，山海皆可平",
        "月色与雪色之间，你是第三种绝色",
        "海底月是天上月，眼前人是心上人"
     ];
     
     let newQuote = sloganText;
     let attempts = 0;
     while ((newQuote === sloganText || newQuote === "-拾光为念，相纸凝成诗行，岁月留芳-") && attempts < 10) {
        newQuote = loveQuotes[Math.floor(Math.random() * loveQuotes.length)];
        attempts++;
     }
     setSloganText(newQuote);

     const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
     const x = (rect.left + rect.width / 2) / window.innerWidth;
     const y = (rect.top + rect.height / 2) / window.innerHeight;

     const heart = confetti.shapeFromPath({
        path: 'M167 102.7c-22.9-29-54.8-41.9-84.6-34.4C30.6 86.8 0 137.9 0 197.6c0 52.8 26.3 113.3 98.4 179.6C163.7 436.3 226.7 480 226.7 480l13.3 9.1 13.3-9.1s63-43.7 128.3-102.8C453.7 310.9 480 250.4 480 197.6c0-59.7-30.6-110.8-82.4-129.3-29.8-7.5-61.7 5.4-84.6 34.4l-31 39.4-31-39.4z'
     });

     confetti({
        particleCount: 60,
        spread: 100,
        origin: { x, y },
        shapes: [heart],
        colors: ['#ff69b4', '#ff1493', '#ff0000'],
        ticks: 300,
        gravity: 0.6,
        scalar: 3,
        startVelocity: 30,
        drift: 0,
        zIndex: 9999
     });
  };

  return (
    <div 
      className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 hidden md:block cursor-pointer select-none group"
      onClick={handleSloganClick}
    >
      <span className="text-[16px] text-[#595959] font-sans group-hover:text-[#ff69b4] transition-colors duration-500">
        {sloganText}
      </span>
    </div>
  );
};
