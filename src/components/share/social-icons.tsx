import type { SVGProps } from "react";

/** Minimal monochrome brand marks — sized/colored via className like lucide icons. */

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M16.6 3c.4 2.1 1.9 3.7 4.1 4v3c-1.5.1-2.9-.4-4.1-1.2v6.6a5.7 5.7 0 1 1-5.7-5.7c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.8 2.5V3h3Z" />
    </svg>
  );
}

export function SnapchatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2.5c2.6 0 4.4 1.9 4.6 4.2l.1 2c0 .2.1.3.3.4.3.1.9-.1 1.3-.3.2-.1.5 0 .6.2l.3.7c.1.2 0 .4-.2.5-.6.4-1.6.9-1.5 1.3.2.7 2.1 1 2.5 1.1.2 0 .3.3.2.5-.2.5-.6.9-1.1 1-.3.1-.9.1-1.2.3-.2.2-.1.7-.3.9-.2.3-1 .2-1.6.4-.5.2-.8.9-2.9.9s-2.4-.7-2.9-.9c-.6-.2-1.4-.1-1.6-.4-.2-.2-.1-.7-.3-.9-.3-.2-.9-.2-1.2-.3-.5-.1-.9-.5-1.1-1-.1-.2 0-.5.2-.5.4-.1 2.3-.4 2.5-1.1.1-.4-.9-.9-1.5-1.3-.2-.1-.3-.3-.2-.5l.3-.7c.1-.2.4-.3.6-.2.4.2 1 .4 1.3.3.2-.1.3-.2.3-.4l.1-2c.2-2.3 2-4.2 4.6-4.2Z" />
    </svg>
  );
}

export function WhatsAppIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .9.9-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.2.2-.3.2-.5.1-.2-.1-1-.4-2-1.2-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.2.2-.4.1-.1.1-.3 0-.4-.1-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9 0 1.1.8 2.2.9 2.4.1.2 1.6 2.4 3.8 3.4.5.2.9.4 1.3.5.5.2 1 .1 1.4.1.4-.1 1.5-.6 1.6-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.4-.3Z" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M13.5 21v-7.5H16l.4-3H13.5V8.4c0-.9.2-1.5 1.6-1.5H16.5V4.3C16.2 4.3 15.2 4.2 14 4.2c-2.4 0-4 1.5-4 4.1v2.2H7.5v3H10V21h3.5Z" />
    </svg>
  );
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4 3h4.4l4 5.7L17.1 3H20l-6.2 8.1L20.4 21H16l-4.4-6.2L6.6 21H4l6.6-8.6L4 3Z" />
    </svg>
  );
}
