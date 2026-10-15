import React, { useState, useEffect } from 'react';

const WHITE_PILL_BUTTONS = [
  'Pitch us an idea',
  'Come work here',
  'Send a brief hello',
  'See how we operate',
];

export const ActionButtons: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const handleCopyEmail = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText('hello@mainframe.co');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textArea = document.createElement('textarea');
      textArea.value = 'hello@mainframe.co';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`flex flex-wrap gap-y-1 ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-[8px] pointer-events-none'
      }`}
      style={{
        transition: 'opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      {/* 4 white pill buttons */}
      {WHITE_PILL_BUTTONS.map((label) => (
        <button
          key={label}
          type="button"
          className="inline-flex items-center justify-center bg-white text-black border border-black/10 rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap cursor-pointer hover:bg-black hover:text-white transition-colors duration-200 select-none shadow-sm"
        >
          {label}
        </button>
      ))}

      {/* 1 outline pill button */}
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleCopyEmail}
          className="inline-flex items-center justify-center text-white bg-transparent border border-white rounded-full text-[13px] sm:text-[15px] px-4 sm:px-5 py-[0.3em] mx-[0.2em] mb-[0.4em] whitespace-nowrap cursor-pointer hover:bg-white hover:text-black transition-colors duration-200 gap-2 sm:gap-3 select-none backdrop-blur-[2px]"
          title="Click to copy email address"
        >
          <span>
            Reach us: <span className="underline underline-offset-1">hello@mainframe.co</span>
          </span>
          {copied ? (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0 text-emerald-400"
            >
              <polyline
                points="2 6 4.8 9 10 3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0"
            >
              <rect
                x="3.5"
                y="3.5"
                width="7"
                height="7"
                rx="1"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="M2.5 8.5H1.8C1.35817 8.5 1 8.14183 1 7.7V1.8C1 1.35817 1.35817 1 1.8 1H7.7C8.14183 1 8.5 1.35817 8.5 1.8V2.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        {/* Copied tooltip notification */}
        {copied && (
          <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black text-white text-[11px] px-2 py-0.5 rounded shadow pointer-events-none transition-opacity duration-200">
            Copied!
          </span>
        )}
      </div>
    </div>
  );
};
