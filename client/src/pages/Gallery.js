import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { galleryData, getGalleryStats, getNextItem, getPreviousItem, getItemById } from '../data/galleryData';
import toast from 'react-hot-toast';
import { X, ChevronLeft, ChevronRight, Download, Play, ZoomIn, ZoomOut } from 'lucide-react';

/**
 * Gallery Component
 * 
 * Features:
 * - Grid layout with lazy-loaded images and videos
 * - Full-screen lightbox viewer with zoom and navigation
 * - Video playback with standard controls
 * - Image download functionality
 * - Responsive design for all devices
 * - Smooth animations and transitions
 * - Keyboard navigation support
 * - Hover overlays with view icon
 * - Image/video count display
 */
export default function Gallery() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [filter, setFilter] = useState('all'); // 'all', 'images', 'videos'
  const [loadedImages, setLoadedImages] = useState(new Set());

  const stats = getGalleryStats();

  // Filter gallery items based on selected filter
  const filteredItems = galleryData.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'images') return item.type === 'image';
    if (filter === 'videos') return item.type === 'video';
    return true;
  });

  // ============================================
  // KEYBOARD NAVIGATION
  // ============================================
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!selectedItem) return;

      switch (e.key) {
        case 'Escape':
          setSelectedItem(null);
          setZoomLevel(1);
          break;
        case 'ArrowRight':
          const nextItem = getNextItem(selectedItem.id);
          setSelectedItem(nextItem);
          setZoomLevel(1);
          break;
        case 'ArrowLeft':
          const prevItem = getPreviousItem(selectedItem.id);
          setSelectedItem(prevItem);
          setZoomLevel(1);
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

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedItem]);

  // ============================================
  // ZOOM FUNCTIONS
  // ============================================
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.2, 1));
  };

  // ============================================
  // DOWNLOAD IMAGE
  // ============================================
  const handleDownloadImage = async (imageUrl, title) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/\s+/g, '_')}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Image downloaded!');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download image');
    }
  };

  // ============================================
  // IMAGE LAZY LOADING
  // ============================================
  const handleImageLoad = useCallback((itemId) => {
    setLoadedImages(prev => new Set([...prev, itemId]));
  }, []);

  // ============================================
  // LIGHTBOX VIEWER COMPONENT
  // ============================================
  const Lightbox = ({ item }) => (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full h-full flex flex-col max-w-6xl animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between text-white p-4 border-b border-white/10">
          <div>
            <h2 className="text-xl md:text-2xl font-bold">{item.title}</h2>
            <p className="text-sm text-gray-300 mt-1">{item.description}</p>
          </div>
          <button
            onClick={() => {
              setSelectedItem(null);
              setZoomLevel(1);
            }}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition"
            title="Close (Esc)"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center overflow-auto bg-black/50">
          {item.type === 'image' ? (
            <div className="flex flex-col items-center justify-center gap-4 p-4">
              <img
                src={item.fullscreen}
                alt={item.title}
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.2s ease-out',
                  maxHeight: '60vh',
                  maxWidth: '90vw',
                  objectFit: 'contain',
                }}
                className="rounded-lg shadow-2xl cursor-move"
              />
            </div>
          ) : (
            <iframe
              width="100%"
              height="600"
              src={item.videoUrl + '?autoplay=0&modestbranding=1&rel=0&showinfo=0'}
              title={item.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="rounded-lg"
              style={{ 
                maxHeight: '70vh', 
                maxWidth: '90vw',
                border: 'none',
              }}
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
        </div>

        {/* Footer Controls */}
        <div className="bg-black/70 border-t border-white/10 p-4 text-white flex flex-wrap items-center justify-between gap-4">
          {/* Left: Navigation & Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                const prevItem = getPreviousItem(item.id);
                setSelectedItem(prevItem);
                setZoomLevel(1);
              }}
              className="hover:bg-white/10 p-2 rounded-lg transition flex items-center gap-2"
              title="Previous (← arrow)"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="hidden sm:inline text-sm">Prev</span>
            </button>
            <span className="text-sm text-gray-300">
              {galleryData.findIndex(i => i.id === item.id) + 1} / {galleryData.length}
            </span>
            <button
              onClick={() => {
                const nextItem = getNextItem(item.id);
                setSelectedItem(nextItem);
                setZoomLevel(1);
              }}
              className="hover:bg-white/10 p-2 rounded-lg transition flex items-center gap-2"
              title="Next (→ arrow)"
            >
              <span className="hidden sm:inline text-sm">Next</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Center: Zoom Controls (Images only) */}
          {item.type === 'image' && (
            <div className="flex items-center gap-2 bg-white/10 rounded-lg p-2">
              <button
                onClick={handleZoomOut}
                className="hover:bg-white/20 p-1 rounded transition"
                title="Zoom out (- key)"
                disabled={zoomLevel <= 1}
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <button
                onClick={handleZoomIn}
                className="hover:bg-white/20 p-1 rounded transition"
                title="Zoom in (+ key)"
                disabled={zoomLevel >= 3}
              >
                <ZoomIn className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Right: Download (Images only) */}
          {item.type === 'image' && (
            <button
              onClick={() => handleDownloadImage(item.fullscreen, item.title)}
              className="flex items-center gap-2 hover:bg-white/10 px-4 py-2 rounded-lg transition bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Download</span>
            </button>
          )}
        </div>

        {/* Keyboard Hints */}
        <div className="bg-black/50 px-4 py-2 text-xs text-gray-400 text-center">
          <span className="hidden sm:inline">
            Keyboard: ESC to close • ← → to navigate
            {item.type === 'image' && ' • +/- to zoom'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-4 rounded-xl shadow-lg">
                <span className="text-3xl">🖼️</span>
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Gallery
                </h1>
                <p className="text-gray-600 mt-1">Explore our library facilities</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link
                to="/dashboard"
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
              >
                Profile
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <p className="text-gray-600 text-sm">Total Items</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalItems}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
              <p className="text-gray-600 text-sm">Photos</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.imageCount}</p>
            </div>
            <div className="bg-pink-50 rounded-lg p-4 border border-pink-100">
              <p className="text-gray-600 text-sm">Videos</p>
              <p className="text-2xl font-bold text-pink-600 mt-1">{stats.videoCount}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-3 mb-8 flex-wrap">
          {[
            { value: 'all', label: 'All', icon: '📋', color: 'purple' },
            { value: 'images', label: 'Photos', icon: '📸', color: 'blue' },
            { value: 'videos', label: 'Videos', icon: '🎬', color: 'pink' },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`group relative px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-3 ${
                filter === tab.value
                  ? `bg-gradient-to-r from-${tab.color}-600 to-${tab.color}-700 text-white shadow-lg shadow-${tab.color}-500/30`
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-' + tab.color + '-300 hover:shadow-md'
              }`}
            >
              <span className={`text-2xl transition-transform duration-300 ${
                filter === tab.value ? 'scale-110' : 'group-hover:scale-110'
              }`}>
                {tab.icon}
              </span>
              <span className="font-bold">{tab.label}</span>
              {filter === tab.value && (
                <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                  {tab.value === 'all' ? stats.totalItems : tab.value === 'images' ? stats.imageCount : stats.videoCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {filteredItems.map(item => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105 cursor-pointer bg-white border border-gray-200"
            >
              {/* Thumbnail */}
              <div className="relative overflow-hidden bg-gray-200 aspect-video">
                <img
                  src={item.thumbnail}
                  alt={item.title}
                  loading="lazy"
                  onLoad={() => handleImageLoad(item.id)}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    loadedImages.has(item.id) ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Loading Skeleton */}
                {!loadedImages.has(item.id) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
                )}

                {/* Video Badge */}
                {item.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition-all">
                      <Play className="w-8 h-8 text-white fill-white" />
                    </div>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transform scale-0 group-hover:scale-100 transition-all duration-300">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30">
                      <span className="text-white text-2xl">👁️</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.description}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <span>{item.type === 'image' ? '📸' : '🎬'}</span>
                  <span className="capitalize">{item.type}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No {filter === 'images' ? 'photos' : filter === 'videos' ? 'videos' : 'items'} found.</p>
          </div>
        )}

        {/* Footer Info */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
          <p className="text-gray-600">
            💡 Click on any image or video to view it in full screen. Use arrow keys to navigate.
          </p>
        </div>
      </div>

      {/* Lightbox */}
      {selectedItem && <Lightbox item={selectedItem} />}
    </div>
  );
}
