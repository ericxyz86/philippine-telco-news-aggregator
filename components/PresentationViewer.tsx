import React, { useState, useEffect, useCallback } from 'react';
import { Presentation, Slide } from '../types';
import pptxgen from 'pptxgenjs';

interface PresentationViewerProps {
  presentation: Presentation;
  onClose: () => void;
}

const PresentationViewer: React.FC<PresentationViewerProps> = ({ presentation, onClose }) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const slides = presentation.slides;

  // Helper function to strip markdown formatting and convert to pptxgen text objects
  const parseMarkdownText = (text: string): Array<{ text: string; options?: { bold?: boolean } }> => {
    const parts: Array<{ text: string; options?: { bold?: boolean } }> = [];
    const regex = /(\*\*.*?\*\*|[^*]+)/g;
    const matches = text.match(regex);

    if (!matches) return [{ text }];

    matches.forEach(match => {
      if (match.startsWith('**') && match.endsWith('**')) {
        // Bold text - remove asterisks and mark as bold
        parts.push({ text: match.slice(2, -2), options: { bold: true } });
      } else {
        // Regular text
        parts.push({ text: match });
      }
    });

    return parts;
  };

  // Helper function to convert image URL to base64
  const urlToBase64 = async (url: string): Promise<string | null> => {
    // Method 1: Try direct fetch (works for most images)
    try {
      console.log(`[Method 1] Trying direct fetch for: ${url}`);
      const response = await fetch(url, {
        mode: 'cors',
        cache: 'no-cache'
      });

      if (!response.ok) {
        console.error(`[Method 1] HTTP ${response.status} for: ${url}`);
        throw new Error(`HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('FileReader failed'));
        reader.readAsDataURL(blob);
      });

      console.log(`[Method 1] ✓ Successfully converted: ${url}`);
      return base64;
    } catch (fetchError) {
      console.warn(`[Method 1] Failed: ${fetchError.message}`);

      // Method 2: Try loading via Image element + canvas (works for some CORS scenarios)
      try {
        console.log(`[Method 2] Trying Image + canvas approach for: ${url}`);

        const base64 = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Request CORS access

          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext('2d');

              if (!ctx) {
                reject(new Error('Canvas context not available'));
                return;
              }

              ctx.drawImage(img, 0, 0);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
              resolve(dataUrl);
            } catch (canvasError) {
              reject(canvasError);
            }
          };

          img.onerror = () => {
            reject(new Error('Image failed to load'));
          };

          img.src = url;
        });

        console.log(`[Method 2] ✓ Successfully converted: ${url}`);
        return base64;
      } catch (canvasError) {
        console.error(`[Method 2] Failed: ${canvasError.message}`);
        console.error(`❌ All methods failed for: ${url} - Image will be skipped in PowerPoint`);
        return null;
      }
    }
  };

  const downloadPowerPoint = useCallback(async () => {
    setIsDownloading(true);
    try {
      const pptx = new pptxgen();

      // Set presentation properties
      pptx.author = 'PLDT Home';
      pptx.company = 'PLDT';
      pptx.title = 'Top Industry News';

      for (const slide of slides) {
        const pptxSlide = pptx.addSlide();

        switch (slide.type) {
          case 'title':
            pptxSlide.background = { color: '1E293B' };
            pptxSlide.addText(slide.title, {
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1.5,
              fontSize: 44,
              bold: true,
              color: 'FFFFFF',
              align: 'center',
              fontFace: 'Roboto',
            });
            pptxSlide.addText(slide.subtitle, {
              x: 0.5,
              y: 4,
              w: 9,
              h: 0.5,
              fontSize: 20,
              color: 'D1D5DB',
              align: 'center',
              fontFace: 'Roboto',
            });
            break;

          case 'news':
            pptxSlide.background = { color: 'F8FAFC' };

            // Add image if available
            if (slide.imageUrl) {
              try {
                const base64Image = await urlToBase64(slide.imageUrl);
                if (base64Image) {
                  pptxSlide.addImage({
                    data: base64Image,
                    x: 0.5,
                    y: 1,
                    w: 4.5,
                    h: 3.5,
                  });
                }
              } catch (error) {
                console.error('Error adding image to slide:', error);
              }
            }

            // Add company name
            if (slide.company) {
              pptxSlide.addText(slide.company, {
                x: 5.2,
                y: 1,
                w: 4.3,
                h: 0.4,
                fontSize: 16,
                bold: true,
                color: 'DC2626',
                fontFace: 'Roboto',
              });
            }

            // Add headline
            pptxSlide.addText(slide.headline, {
              x: 5.2,
              y: 1.5,
              w: 4.3,
              h: 1.2,
              fontSize: 20,
              bold: true,
              color: '1E293B',
              fontFace: 'Roboto',
            });

            // Add summary
            pptxSlide.addText(slide.summary, {
              x: 5.2,
              y: 2.8,
              w: 4.3,
              h: 1.5,
              fontSize: 14,
              color: '475569',
              fontFace: 'Roboto',
            });

            // Add source link
            if (slide.sourceUrl && slide.sourceTitle) {
              pptxSlide.addText(`Source: ${slide.sourceTitle}`, {
                x: 5.2,
                y: 4.4,
                w: 4.3,
                h: 0.3,
                fontSize: 10,
                color: '2563EB',
                hyperlink: { url: slide.sourceUrl },
                fontFace: 'Roboto',
              });
            }
            break;

          case 'significance':
            pptxSlide.background = { color: 'FFFFFF' };
            pptxSlide.addText(slide.title, {
              x: 0.5,
              y: 0.5,
              w: 9,
              h: 0.8,
              fontSize: 32,
              bold: true,
              color: '1E293B',
              fontFace: 'Roboto',
            });

            slide.points.forEach((point, index) => {
              // Parse markdown and create text with proper bold formatting
              const parsedText = parseMarkdownText(point);
              pptxSlide.addText(parsedText, {
                x: 1,
                y: 1.5 + (index * 0.7),
                w: 8,
                h: 0.6,
                fontSize: 16,
                color: '475569',
                bullet: { type: 'bullet', characterCode: '2022' },
                fontFace: 'Roboto',
              });
            });
            break;

          case 'end':
            pptxSlide.background = { color: 'F8FAFC' };
            pptxSlide.addText(slide.title, {
              x: 0.5,
              y: 2.5,
              w: 9,
              h: 1,
              fontSize: 40,
              bold: true,
              color: 'DC2626',
              align: 'center',
              fontFace: 'Roboto',
            });
            break;
        }
      }

      await pptx.writeFile({ fileName: 'Telco_Industry_News.pptx' });
    } catch (error) {
      console.error('Error generating PowerPoint:', error);
      alert('Failed to generate PowerPoint presentation. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [slides, urlToBase64]);

  const goToNextSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goToPrevSlide = () => {
    setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNextSlide();
      } else if (e.key === 'ArrowLeft') {
        goToPrevSlide();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [goToNextSlide, goToPrevSlide, onClose]);

  const currentSlide = slides[currentSlideIndex];
  const isDarkTheme = currentSlide.type === 'title';

  const navTextColor = isDarkTheme ? 'text-white' : 'text-slate-700';
  const navButtonBg = isDarkTheme ? 'bg-white/20' : 'bg-black/10';
  const navButtonHoverBg = isDarkTheme ? 'hover:bg-white/40' : 'hover:bg-black/20';
  
  const closeButtonTextColor = isDarkTheme ? 'text-white' : 'text-slate-600';
  const closeButtonBg = isDarkTheme ? 'bg-black/30' : 'bg-black/10';
  const closeButtonHoverBg = isDarkTheme ? 'hover:bg-black/50' : 'hover:bg-black/20';

  const renderSlide = (slide: Slide) => {
    switch (slide.type) {
      case 'title':
        return (
          <div className="flex flex-col justify-center items-center text-center h-full bg-slate-900" style={{backgroundImage: 'radial-gradient(circle at top right, rgb(20 30 100 / 0.5), transparent), radial-gradient(circle at bottom left, rgb(100 20 50 / 0.5), transparent)'}}>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white">{slide.title}</h1>
            <p className="mt-4 text-xl md:text-2xl text-gray-300">{slide.subtitle}</p>
          </div>
        );
      case 'news':
        return (
          <div className="flex flex-col md:flex-row h-full gap-8 p-8 md:p-16 bg-slate-50 text-slate-800">
            <div className="w-full md:w-1/2 flex items-center justify-center bg-slate-200 rounded-lg overflow-hidden">
                {slide.imageUrl ? (
                    <img src={slide.imageUrl} alt={slide.imageDescription} className="w-full h-full object-cover" />
                ) : (
                    <div className="text-center p-4">
                        <p className="text-sm text-slate-500 mb-2">Generating Image...</p>
                        <p className="text-slate-700 italic">{slide.imageDescription}</p>
                    </div>
                )}
            </div>
            <div className="w-full md:w-1/2 flex flex-col justify-center">
              {slide.company && <p className="text-red-600 font-bold text-lg mb-2 tracking-wide">{slide.company}</p>}
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{slide.headline}</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-4">{slide.summary}</p>
              {slide.sourceUrl && (
                <a
                  href={slide.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Source: {slide.sourceTitle || 'Read full article'}
                </a>
              )}
            </div>
          </div>
        );
      case 'significance':
        return (
          <div className="p-8 md:p-16 bg-white text-slate-800 h-full">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-slate-900">{slide.title}</h2>
            <ul className="space-y-4">
              {slide.points.map((point, index) => (
                <li key={index} className="flex items-start">
                  <svg className="w-6 h-6 mr-3 mt-1 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-lg text-slate-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        );
        case 'end':
            return (
              <div className="flex flex-col justify-center items-center text-center h-full bg-slate-50 text-slate-800">
                <h1 className="text-4xl md:text-5xl font-bold text-red-600">{slide.title}</h1>
              </div>
            );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="aspect-video w-full max-w-6xl shadow-2xl rounded-lg relative overflow-hidden bg-white">
        {renderSlide(slides[currentSlideIndex])}
        
        {/* Navigation */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
          <button
            onClick={goToPrevSlide}
            disabled={currentSlideIndex === 0}
            className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm ${navTextColor} ${navButtonBg} ${navButtonHoverBg} transition-colors`}
            aria-label="Previous slide"
          >
            Prev
          </button>
          <span className={`text-sm font-medium ${navTextColor}`}>
            {currentSlideIndex + 1} / {slides.length}
          </span>
          <button
            onClick={goToNextSlide}
            disabled={currentSlideIndex === slides.length - 1}
            className={`px-4 py-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm ${navTextColor} ${navButtonBg} ${navButtonHoverBg} transition-colors`}
            aria-label="Next slide"
          >
            Next
          </button>
        </div>
        
        {/* Download PowerPoint Button */}
        <button
          onClick={downloadPowerPoint}
          disabled={isDownloading}
          className={`absolute top-4 right-16 rounded-full p-2 ${closeButtonTextColor} ${closeButtonBg} ${closeButtonHoverBg} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label="Download PowerPoint"
          title="Download as PowerPoint"
        >
          {isDownloading ? (
            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </button>

        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 rounded-full p-2 ${closeButtonTextColor} ${closeButtonBg} ${closeButtonHoverBg} transition-colors`}
          aria-label="Close presentation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
         
         {/* Footer Branding */}
        <div className="absolute bottom-5 right-5 text-red-600 font-bold text-xl opacity-50">
           PLDT Home
        </div>
      </div>
    </div>
  );
};

export default PresentationViewer;