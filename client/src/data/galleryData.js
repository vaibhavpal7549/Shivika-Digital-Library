/**
 * ============================================
 * GALLERY DATA FILE
 * ============================================
 * 
 * This file contains all gallery media items (photos and videos).
 * 
 * HOW TO ADD NEW PHOTOS/VIDEOS:
 * =============================
 * 
 * 1. FOR IMAGES:
 *    Add a new object to the GALLERY_ITEMS array with:
 *    {
 *      id: <unique_number>,
 *      type: 'image',
 *      src: '<image_url>',           // Direct URL to the image
 *      thumbnail: '<thumbnail_url>', // Optional: smaller version for grid (improves performance)
 *      title: '<title>',             // Display title
 *      description: '<description>', // Optional description
 *      category: '<category>',       // For filtering: 'interior', 'exterior', 'facilities', 'events'
 *    }
 * 
 * 2. FOR VIDEOS:
 *    Add a new object to the GALLERY_ITEMS array with:
 *    {
 *      id: <unique_number>,
 *      type: 'video',
 *      src: '<video_url>',           // Direct URL to the video file (MP4 recommended)
 *      thumbnail: '<poster_image>',  // Poster/thumbnail image for the video
 *      title: '<title>',
 *      description: '<description>',
 *      category: '<category>',
 *    }
 * 
 * 3. FOR LOCAL FILES:
 *    - Place images in: public/gallery/images/
 *    - Place videos in: public/gallery/videos/
 *    - Reference as: '/gallery/images/filename.jpg' or '/gallery/videos/filename.mp4'
 * 
 * CATEGORIES:
 * - 'interior'   : Inside library views
 * - 'exterior'   : Building exterior
 * - 'facilities' : AC, WiFi, amenities
 * - 'events'     : Library events
 * - 'study'      : Study areas, seats
 */

// Demo images using Unsplash (free, high-quality stock photos)
// Replace these with actual library photos in production
export const GALLERY_ITEMS = [
  // ============================================
  // INTERIOR IMAGES
  // ============================================
  {
    id: 1,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&q=60',
    title: 'Main Reading Hall',
    description: 'Spacious reading area with comfortable seating and natural lighting',
    category: 'interior',
  },
  {
    id: 2,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=60',
    title: 'Study Desks',
    description: 'Individual study desks with power outlets and reading lamps',
    category: 'study',
  },
  {
    id: 3,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=60',
    title: 'Book Collection',
    description: 'Extensive collection of academic and reference books',
    category: 'interior',
  },
  {
    id: 4,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&q=60',
    title: 'Bookshelf Section',
    description: 'Well-organized bookshelves for easy navigation',
    category: 'interior',
  },
  
  // ============================================
  // STUDY AREA IMAGES
  // ============================================
  {
    id: 5,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=400&q=60',
    title: 'Group Study Area',
    description: 'Collaborative spaces for group discussions and projects',
    category: 'study',
  },
  {
    id: 6,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400&q=60',
    title: 'Quiet Zone',
    description: 'Silent study area for focused learning',
    category: 'study',
  },
  {
    id: 7,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=60',
    title: 'Computer Section',
    description: 'Modern computers with high-speed internet access',
    category: 'facilities',
  },
  
  // ============================================
  // FACILITIES IMAGES
  // ============================================
  {
    id: 8,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=60',
    title: 'Modern Interior',
    description: 'Contemporary design with excellent lighting',
    category: 'interior',
  },
  {
    id: 9,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&q=60',
    title: 'Lounge Area',
    description: 'Comfortable seating for relaxation between study sessions',
    category: 'facilities',
  },
  {
    id: 10,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1606761568499-6d2451b23c66?w=400&q=60',
    title: 'Reading Corner',
    description: 'Cozy corner for leisure reading',
    category: 'interior',
  },
  
  // ============================================
  // EXTERIOR IMAGES
  // ============================================
  {
    id: 11,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=400&q=60',
    title: 'Library Entrance',
    description: 'Welcome to Shivika Digital Library',
    category: 'exterior',
  },
  {
    id: 12,
    type: 'image',
    src: 'https://images.unsplash.com/photo-1562774053-701939374585?w=1200&q=80',
    thumbnail: 'https://images.unsplash.com/photo-1562774053-701939374585?w=400&q=60',
    title: 'Building View',
    description: 'Modern architecture with ample parking space',
    category: 'exterior',
  },
  
  // ============================================
  // DEMO VIDEOS
  // ============================================
  // Using sample videos from reliable sources
  {
    id: 101,
    type: 'video',
    src: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=400&q=60',
    title: 'Library Tour',
    description: 'Take a virtual tour of our library facilities',
    category: 'interior',
  },
  {
    id: 102,
    type: 'video',
    src: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_2mb.mp4',
    thumbnail: 'https://images.unsplash.com/photo-1568667256549-094345857637?w=400&q=60',
    title: 'Study Environment',
    description: 'See the peaceful study environment in action',
    category: 'study',
  },
];

// ============================================
// CATEGORY DEFINITIONS
// ============================================
export const GALLERY_CATEGORIES = [
  { id: 'all', label: 'All', icon: '🖼️' },
  { id: 'interior', label: 'Interior', icon: '🏛️' },
  { id: 'study', label: 'Study Areas', icon: '📚' },
  { id: 'facilities', label: 'Facilities', icon: '🖥️' },
  { id: 'exterior', label: 'Exterior', icon: '🏢' },
  { id: 'events', label: 'Events', icon: '🎉' },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get items by category
 * @param {string} category - Category to filter by ('all' returns everything)
 * @returns {Array} Filtered gallery items
 */
export const getItemsByCategory = (category) => {
  if (category === 'all') return GALLERY_ITEMS;
  return GALLERY_ITEMS.filter(item => item.category === category);
};

/**
 * Get count of images and videos
 * @returns {Object} { images: number, videos: number, total: number }
 */
export const getMediaCounts = () => {
  const images = GALLERY_ITEMS.filter(item => item.type === 'image').length;
  const videos = GALLERY_ITEMS.filter(item => item.type === 'video').length;
  return { images, videos, total: GALLERY_ITEMS.length };
};

/**
 * Get only images
 * @returns {Array} Image items only
 */
export const getImages = () => GALLERY_ITEMS.filter(item => item.type === 'image');

/**
 * Get only videos
 * @returns {Array} Video items only
 */
export const getVideos = () => GALLERY_ITEMS.filter(item => item.type === 'video');
