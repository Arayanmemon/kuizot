/**
 * QuestionMedia — renders image/GIF or YouTube embed based on the URL.
 * Supports:
 *   - Regular images and GIFs (any URL ending in .png/.jpg/.jpeg/.gif/.webp)
 *   - YouTube: https://youtube.com/watch?v=ID, https://youtu.be/ID, https://youtube.com/shorts/ID
 */

interface QuestionMediaProps {
  url: string;
  className?: string;
}

/**
 * Extracts the YouTube video ID from various YouTube URL formats.
 * Returns null if the URL is not a YouTube URL.
 */
function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    // youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return u.pathname.slice(1).split('?')[0] || null;
    }
    // youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      // youtube.com/shorts/ID or youtube.com/embed/ID
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'shorts' || parts[0] === 'embed') return parts[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export const QuestionMedia = ({ url, className = '' }: QuestionMediaProps) => {
  if (!url) return null;

  const youtubeId = getYouTubeId(url);

  if (youtubeId) {
    return (
      <div className={`relative w-full overflow-hidden rounded-xl ${className}`} style={{ paddingTop: '56.25%' /* 16:9 */ }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${youtubeId}?autoplay=0&rel=0&modestbranding=1`}
          title="Question video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Treat everything else as an image / GIF
  return (
    <img
      src={url}
      alt="Question media"
      className={`w-full object-contain rounded-xl max-h-64 ${className}`}
      loading="lazy"
      onError={(e) => {
        // Hide broken images instead of showing the broken icon
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
};
