import { EXAMPLE_LAYOUTS } from "@/lib/demo";

/** Fixed abstract layout teaching diagrams. Never based on the user's story. */
export default function ExampleLayout({ index }: { index: number }) {
  return (
    <svg viewBox="0 0 320 320" role="img" aria-label={`Abstract example layout: ${EXAMPLE_LAYOUTS[index].label}. Not a personalised tattoo design.`} className="h-auto w-full">
      <rect width="320" height="320" fill="#17171c" />
      <g fill="none" stroke="#c9a26b" strokeWidth="2">
        {index === 0 && <><circle cx="160" cy="155" r="42" /><circle cx="160" cy="155" r="80" strokeDasharray="3 7" opacity=".5" /></>}
        {index === 1 && <><circle cx="160" cy="150" r="48" /><circle cx="75" cy="175" r="24" /><circle cx="245" cy="175" r="24" /><path d="M75 218H245" strokeDasharray="3 7" opacity=".5" /></>}
        {index === 2 && <><path d="M68 252Q115 124 246 64" strokeDasharray="3 7" opacity=".5" /><circle cx="105" cy="207" r="26" /><circle cx="158" cy="148" r="40" /><circle cx="220" cy="97" r="20" /></>}
      </g>
      <text x="160" y="293" fill="#b9b9c1" fontSize="12" fontFamily="sans-serif" textAnchor="middle">ABSTRACT LAYOUT EXAMPLE</text>
    </svg>
  );
}
