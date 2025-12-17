/**
 * ============================================
 * GALLERY COMPONENT
 * ============================================
 * 
 * A full-featured gallery component for displaying library photos and videos.
 * 
 * FEATURES:
 * - Responsive grid layout (mobile, tablet, desktop)
 * - Category filtering
 * - Lightbox-style full-screen preview
 * - Zoom in/out for images
 * - Next/previous navigation (keyboard + touch + click)
 * - Download option for images
 * - Video playback with standard controls
 * - Lazy loading for performance
 * - Smooth animations and transitions
 * - Accessibility support (ARIA labels, keyboard navigation)
 * 
 * USAGE:
 * import Gallery from './components/Gallery';
 * <Gallery isOpen={true} onClose={() => setIsOpen(false)} />
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Play, 
  Image as ImageIcon,
  Video,
  Minimize2,
  Eye
} from 'lucide-react';
import { 
  GALLERY_ITEMS, 
  GALLERY_CATEGORIES, 
  getItemsByCategory, 
  getMediaCounts 
} from '../data/galleryData';

// ============================================
// LAZY IMAGE COMPONENT
// ============================================
/**
 * LazyImage - Loads images only when they enter viewport
 * Improves initial page load performance
 */
const LazyImage = ({ src, alt, className, onClick }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before entering viewport
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative ${className}`} onClick={onClick}>
      {/* Placeholder skeleton */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse rounded-lg" />
      )}
      
      {/* Actual image - only loads when in view */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          loading="lazy"
        />
      )}
    </div>
  );
};

// ============================================
// GALLERY ITEM CARD COMPONENT
// ============================================
/**
 * GalleryCard - Individual media item card with hover overlay
 */
const GalleryCard = ({ item, onClick }) => {
  const isVideo = item.type === 'video';

  return (
    <div
      className="relative group cursor-pointer overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] bg-gray-100"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`View ${item.title}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Thumbnail Image */}
      <LazyImage
        src={item.thumbnail || item.src}
        alt={item.title}
        className="aspect-[4/3] w-full"
      />
      
      {/* Video indicator badge */}
      {isVideo && (
        <div className="absolute top-3 right-3 bg-black/70 text-white px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 z-10">
          <Play className="w-3 h-3" fill="currentColor" />
          <span>Video</span>
        </div>
      )}
      
      {/* Hover Overlay with View Icon */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
        {/* Center view icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transform scale-0 group-hover:scale-100 transition-transform duration-300 border-2 border-white/50">
            {isVideo ? (
              <Play className="w-7 h-7 text-white ml-1" fill="currentColor" />
            ) : (
              <Eye className="w-7 h-7 text-white" />
            )}
          </div>
        </div>
        
        {/* Title and description */}
        <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
          <h3 className="text-white font-semibold text-sm md:text-base truncate">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-white/80 text-xs md:text-sm line-clamp-2 mt-1">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// LIGHTBOX VIEWER COMPONENT
// ============================================
/**
 * Lightbox - Full-screen media viewer with controls
 */
const Lightbox = ({ items, currentIndex, onClose, onNavigate }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const videoRef = useRef(null);
  
  const currentItem = items[currentIndex];
  const isVideo = currentItem?.type === 'video';
  
  // Reset zoom and position when changing items
  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onNavigate('prev');
          break;
        case 'ArrowRight':
          onNavigate('next');
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Zoom handlers
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = () => {
    setZoom(prev => {
      const newZoom = Math.max(prev - 0.5, 1);
      if (newZoom === 1) setPosition({ x: 0, y: 0 });
      return newZoom;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Drag handlers for panning zoomed image
  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e) => {
    if (zoom > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  // Download handler
  const handleDownload = async () => {
    try {
      const response = await fetch(currentItem.src);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentItem.title || 'gallery-image'}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Fallback: open in new tab
      window.open(currentItem.src, '_blank');
    }
  };

  // Swipe detection for mobile navigation
  const touchStartX = useRef(0);
  const handleSwipeStart = (e) => {
    if (zoom === 1) {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const handleSwipeEnd = (e) => {
    if (zoom === 1) {
      const touchEndX = e.changedTouches[0].clientX;
      const diff = touchStartX.current - touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) {
          onNavigate('next');
        } else {
          onNavigate('prev');
        }
      }
    }
  };

  if (!currentItem) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex flex-col animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Gallery lightbox"
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-20">
        {/* Title */}
        <div className="flex-1 min-w-0 mr-4">
          <h3 className="text-white font-semibold text-sm md:text-lg truncate">
            {currentItem.title}
          </h3>
          <p className="text-white/60 text-xs md:text-sm">
            {currentIndex + 1} of {items.length}
          </p>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center gap-1 md:gap-2">
          {/* Zoom controls - only for images */}
          {!isVideo && (
            <>
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 1}
                className="p-2 md:p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Zoom out"
                title="Zoom out (-)"
              >
                <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <span className="text-white text-xs md:text-sm min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 4}
                className="p-2 md:p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Zoom in"
                title="Zoom in (+)"
              >
                <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              {zoom > 1 && (
                <button
                  onClick={handleResetZoom}
                  className="p-2 md:p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                  aria-label="Reset zoom"
                  title="Reset zoom"
                >
                  <Minimize2 className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
              <div className="w-px h-6 bg-white/30 mx-1 hidden md:block" />
            </>
          )}
          
          {/* Download button - only for images */}
          {!isVideo && (
            <button
              onClick={handleDownload}
              className="p-2 md:p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Download image"
              title="Download"
            >
              <Download className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          )}
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 md:p-2.5 rounded-lg bg-white/10 hover:bg-red-500/80 text-white transition-colors ml-1 md:ml-2"
            aria-label="Close gallery"
            title="Close (Esc)"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div 
        className="flex-1 flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => {
          handleTouchStart(e);
          handleSwipeStart(e);
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => {
          handleMouseUp();
          handleSwipeEnd(e);
        }}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {isVideo ? (
          // Video player
          <video
            ref={videoRef}
            src={currentItem.src}
            poster={currentItem.thumbnail}
            controls
            autoPlay
            className="max-w-full max-h-[80vh] rounded-lg shadow-2xl"
            style={{ outline: 'none' }}
          >
            Your browser does not support the video tag.
          </video>
        ) : (
          // Image viewer
          <img
            src={currentItem.src}
            alt={currentItem.title}
            className="max-w-full max-h-[80vh] object-contain transition-transform duration-200 select-none"
            style={{
              transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            }}
            draggable={false}
          />
        )}
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          {/* Previous button */}
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/30 text-white transition-all transform hover:scale-110 z-10"
            aria-label="Previous image"
            title="Previous (←)"
          >
            <ChevronLeft className="w-6 h-6 md:w-8 md:h-8" />
          </button>
          
          {/* Next button */}
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2 md:p-3 rounded-full bg-white/10 hover:bg-white/30 text-white transition-all transform hover:scale-110 z-10"
            aria-label="Next image"
            title="Next (→)"
          >
            <ChevronRight className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        </>
      )}

      {/* Bottom info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        {currentItem.description && (
          <p className="text-white/80 text-sm md:text-base text-center max-w-2xl mx-auto">
            {currentItem.description}
          </p>
        )}
        
        {/* Thumbnail navigation dots */}
        <div className="flex justify-center gap-1.5 mt-3">
          {items.slice(0, 10).map((item, idx) => (
            <button
              key={item.id}
              onClick={() => onNavigate(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Go to image ${idx + 1}`}
            />
          ))}
          {items.length > 10 && (
            <span className="text-white/60 text-xs ml-2">
              +{items.length - 10} more
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ============================================
// MAIN GALLERY COMPONENT
// ============================================
/**
 * Gallery - Main gallery modal component
 * @param {boolean} isOpen - Whether the gallery modal is open
 * @param {function} onClose - Handler to close the gallery
 */
export default function Gallery({ isOpen, onClose }) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  
  const mediaCounts = getMediaCounts();
  const filteredItems = getItemsByCategory(activeCategory);
  
  // Handle navigation in lightbox
  const handleNavigate = useCallback((direction) => {
    if (typeof direction === 'number') {
      // Direct index navigation
      setLightboxIndex(direction);
    } else if (direction === 'prev') {
      setLightboxIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (direction === 'next') {
      setLightboxIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    }
  }, [filteredItems.length]);

  // Close lightbox
  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

  // Handle escape key to close gallery
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && lightboxIndex === null) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lightboxIndex, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-40 flex flex-col bg-gray-50 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Photo gallery"
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4 md:px-6 md:py-5 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            {/* Title and counts */}
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <ImageIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-gray-800">
                  Library Gallery
                </h2>
                <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <ImageIcon className="w-4 h-4" />
                    {mediaCounts.images} Photos
                  </span>
                  <span className="flex items-center gap-1">
                    <Video className="w-4 h-4" />
                    {mediaCounts.videos} Videos
                  </span>
                </div>
              </div>
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 transition-colors"
              aria-label="Close gallery"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Category filters */}
          <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
            {GALLERY_CATEGORIES.map((category) => {
              const count = category.id === 'all' 
                ? GALLERY_ITEMS.length 
                : GALLERY_ITEMS.filter(item => item.category === category.id).length;
              
              if (count === 0 && category.id !== 'all') return null;
              
              return (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                    activeCategory === category.id
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    activeCategory === category.id
                      ? 'bg-white/20'
                      : 'bg-gray-200'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Gallery Grid */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {filteredItems.length === 0 ? (
            // Empty state
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <ImageIcon className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">
                No items in this category
              </h3>
              <p className="text-gray-500 text-sm">
                Try selecting a different category
              </p>
            </div>
          ) : (
            // Grid layout
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
              {filteredItems.map((item, index) => (
                <GalleryCard
                  key={item.id}
                  item={item}
                  onClick={() => setLightboxIndex(index)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer hint */}
      <footer className="bg-white border-t border-gray-200 px-4 py-3 text-center text-sm text-gray-500 flex-shrink-0">
        <p>
          Click on any photo to view in full screen • Use arrow keys to navigate • Press Esc to close
        </p>
      </footer>

      {/* Lightbox viewer */}
      {lightboxIndex !== null && (
        <Lightbox
          items={filteredItems}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={handleNavigate}
        />
      )}
    </div>,
    document.body
  );
}

// ============================================
// GALLERY BUTTON COMPONENT (for embedding)
// ============================================
/**
 * GalleryButton - A button to open the gallery
 * Can be used anywhere in the app
 */
export function GalleryButton({ className = '' }) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const mediaCounts = getMediaCounts();

  return (
    <>
      <button
        onClick={() => setIsGalleryOpen(true)}
        className={`flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] ${className}`}
        aria-label="Open photo gallery"
      >
        <ImageIcon className="w-5 h-5" />
        <span>Gallery</span>
        <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
          {mediaCounts.total}
        </span>
      </button>
      
      <Gallery isOpen={isGalleryOpen} onClose={() => setIsGalleryOpen(false)} />
    </>
  );
}
