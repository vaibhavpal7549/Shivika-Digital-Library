/**
 * Gallery Data
 * 
 * Centralized storage for all gallery photos and videos.
 * This file makes it easy to add/update gallery content without touching the component.
 * 
 * How to add new photos/videos:
 * 1. For IMAGES:
 *    - Add entry with type: 'image'
 *    - Provide thumbnail URL (used in grid)
 *    - Provide fullscreen URL (can be same or higher quality)
 *    - Add descriptive title and description
 * 
 * 2. For VIDEOS:
 *    - Add entry with type: 'video'
 *    - Provide video URL (YouTube embed, MP4, WebM, etc.)
 *    - Add descriptive title and description
 * 
 * Example Image Entry:
 * {
 *   id: 'img_001',
 *   type: 'image',
 *   title: 'Library Overview',
 *   description: 'Wide view of the main study area',
 *   thumbnail: 'https://url-to-thumbnail.jpg',
 *   fullscreen: 'https://url-to-full-image.jpg',
 * }
 * 
 * Example Video Entry:
 * {
 *   id: 'vid_001',
 *   type: 'video',
 *   title: 'Library Tour',
 *   description: 'Complete walkthrough of our facilities',
 *   videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
 *   thumbnail: 'https://url-to-video-thumbnail.jpg',
 * }
 */

export const galleryData = [
  // ============================================
  // IMAGES - Library Photos
  // ============================================
  {
    id: 'img_001',
    type: 'image',
    title: 'Main Study Hall',
    description: 'Our spacious main study area with natural lighting and comfortable seating',
    thumbnail: 'https://images.unsplash.com/photo-1507842957697-1f57af95c1b1?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1507842957697-1f57af95c1b1?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_002',
    type: 'image',
    title: 'Reading Corner',
    description: 'Quiet reading area with soft ambient lighting and premium seating',
    thumbnail: 'https://images.unsplash.com/photo-1501339847302-ac426a220e5f?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1501339847302-ac426a220e5f?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_003',
    type: 'image',
    title: 'Computer Lab',
    description: 'Modern computer workstations with high-speed internet and latest software',
    thumbnail: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_004',
    type: 'image',
    title: 'Reference Library',
    description: 'Extensive collection of books and reference materials',
    thumbnail: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_005',
    type: 'image',
    title: 'Group Study Rooms',
    description: 'Private meeting rooms available for collaborative study sessions',
    thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_006',
    type: 'image',
    title: 'Cafeteria',
    description: 'Comfortable cafeteria with refreshments and break areas',
    thumbnail: 'https://images.unsplash.com/photo-1559521292-c5b2c4c47e43?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1559521292-c5b2c4c47e43?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_007',
    type: 'image',
    title: 'Workspace Amenities',
    description: 'Ergonomic chairs, spacious desks, and proper ventilation throughout',
    thumbnail: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=1200&h=900&fit=crop',
  },
  {
    id: 'img_008',
    type: 'image',
    title: 'Night Study',
    description: 'Well-lit study area available for evening study sessions',
    thumbnail: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=400&h=300&fit=crop',
    fullscreen: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=1200&h=900&fit=crop',
  },

  // ============================================
  // VIDEOS - Library Tours & Guides
  // ============================================
  {
    id: 'vid_001',
    type: 'video',
    title: 'Library Overview Tour',
    description: 'Complete walkthrough of all library facilities and amenities',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
  },
  {
    id: 'vid_002',
    type: 'video',
    title: 'How to Book a Seat',
    description: 'Step-by-step guide on booking your preferred study seat',
    videoUrl: 'https://www.youtube.com/embed/jNQXAC9IVRw',
    thumbnail: 'https://img.youtube.com/vi/jNQXAC9IVRw/mqdefault.jpg',
  },
  {
    id: 'vid_003',
    type: 'video',
    title: 'Facility Highlights',
    description: 'Quick tour of our premium study spaces and facilities',
    videoUrl: 'https://www.youtube.com/embed/9bZkp7q19f0',
    thumbnail: 'https://img.youtube.com/vi/9bZkp7q19f0/mqdefault.jpg',
  },
];

/**
 * Helper function to get gallery statistics
 * Returns count of images and videos
 */
export function getGalleryStats() {
  const images = galleryData.filter(item => item.type === 'image');
  const videos = galleryData.filter(item => item.type === 'video');
  
  return {
    totalItems: galleryData.length,
    imageCount: images.length,
    videoCount: videos.length,
  };
}

/**
 * Helper function to get next item in gallery
 * Useful for carousel/navigation
 */
export function getNextItem(currentId) {
  const currentIndex = galleryData.findIndex(item => item.id === currentId);
  if (currentIndex === -1 || currentIndex === galleryData.length - 1) {
    return galleryData[0]; // Loop to start
  }
  return galleryData[currentIndex + 1];
}

/**
 * Helper function to get previous item in gallery
 */
export function getPreviousItem(currentId) {
  const currentIndex = galleryData.findIndex(item => item.id === currentId);
  if (currentIndex === -1 || currentIndex === 0) {
    return galleryData[galleryData.length - 1]; // Loop to end
  }
  return galleryData[currentIndex - 1];
}

/**
 * Helper function to get item by ID
 */
export function getItemById(id) {
  return galleryData.find(item => item.id === id);
}
