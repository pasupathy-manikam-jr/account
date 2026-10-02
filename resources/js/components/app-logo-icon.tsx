import type { SVGAttributes } from 'react';

// Three rising bars: the app's mark (also public/favicon.svg).
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <rect x="3.5" y="13" width="4.5" height="7.5" rx="1.2" />
            <rect x="9.75" y="8.5" width="4.5" height="12" rx="1.2" />
            <rect x="16" y="3.5" width="4.5" height="17" rx="1.2" />
        </svg>
    );
}
