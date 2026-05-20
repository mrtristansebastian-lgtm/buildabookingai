export const hexToHsl = (hex) => {
            if (!hex || typeof hex !== 'string' || hex === 'transparent') return { h: 0, s: 0, l: 100 };
            const clean = hex.replace('#', '').trim();
            if (clean.length !== 6) return { h: 0, s: 0, l: 100 };
            let r = parseInt(clean.slice(0, 2), 16) / 255;
            let g = parseInt(clean.slice(2, 4), 16) / 255;
            let b = parseInt(clean.slice(4, 6), 16) / 255;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            let h = 0;
            let s = 0;
            const l = (max + min) / 2;
            if (max !== min) {
                const d = max - min;
                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                switch (max) {
                    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                    case g: h = (b - r) / d + 2; break;
                    default: h = (r - g) / d + 4; break;
                }
                h *= 60;
            }
            return { h, s: s * 100, l: l * 100 };
        };

        export const hueBetween = (h, start, end) => start <= end ? h >= start && h < end : h >= start || h < end;
        export const themePrimary = (theme) => hexToHsl(theme.primaryColor);
        export const themeBackground = (theme) => hexToHsl(theme.backgroundColor);
        export const isNeutralTheme = (theme) => themePrimary(theme).s < 12 || ['#000000', '#FFFFFF', '#111827'].includes((theme.primaryColor || '').toUpperCase());

        const hasThemeTag = (theme, key, tags) => Array.isArray(theme[key]) && tags.some(tag => theme[key].includes(tag));

        export const THEME_PALETTE_FILTERS = [
            { id: 'all', name: 'All', hint: 'Full Library', swatches: ['#050505', '#FFFFFF', '#39FF14'], match: () => true },
            { id: 'dark', name: 'Dark', hint: 'Noir & Night', swatches: ['#030712', '#111827', '#39FF14'], match: (theme) => theme.palette === 'dark' || themeBackground(theme).l < 18 },
            { id: 'neutral', name: 'Neutral', hint: 'Black, White, Grey', swatches: ['#000000', '#F9FAFB', '#6B7280'], match: (theme) => theme.palette === 'neutral' || isNeutralTheme(theme) },
            { id: 'blue', name: 'Blue', hint: 'Calm & Trust', swatches: ['#DBEAFE', '#2563EB', '#082F49'], match: (theme) => theme.palette === 'blue' || (hueBetween(themePrimary(theme).h, 190, 255) && !isNeutralTheme(theme)) },
            { id: 'green', name: 'Green', hint: 'Fresh & Natural', swatches: ['#D1FAE5', '#10B981', '#064E3B'], match: (theme) => theme.palette === 'green' || (hueBetween(themePrimary(theme).h, 100, 170) && !isNeutralTheme(theme)) },
            { id: 'purple', name: 'Purple', hint: 'Creative & Luxe', swatches: ['#EDE9FE', '#7C3AED', '#2E1065'], match: (theme) => theme.palette === 'purple' || (hueBetween(themePrimary(theme).h, 255, 295) && !isNeutralTheme(theme)) },
            { id: 'pink', name: 'Pink', hint: 'Soft & Bold', swatches: ['#FCE7F3', '#DB2777', '#500724'], match: (theme) => theme.palette === 'pink' || (hueBetween(themePrimary(theme).h, 295, 345) && !isNeutralTheme(theme)) },
            { id: 'red', name: 'Red', hint: 'Drama & Heat', swatches: ['#FFE4E6', '#BE123C', '#4C0519'], match: (theme) => theme.palette === 'red' || (hueBetween(themePrimary(theme).h, 345, 15) && !isNeutralTheme(theme)) },
            { id: 'orange', name: 'Orange', hint: 'Warm & Confident', swatches: ['#FFEDD5', '#F97316', '#431407'], match: (theme) => theme.palette === 'orange' || (hueBetween(themePrimary(theme).h, 15, 38) && !isNeutralTheme(theme)) },
            { id: 'yellow', name: 'Yellow', hint: 'Gold & Sunny', swatches: ['#FEF9C3', '#EAB308', '#422006'], match: (theme) => theme.palette === 'yellow' || (hueBetween(themePrimary(theme).h, 38, 65) && !isNeutralTheme(theme)) },
            { id: 'earth', name: 'Earth', hint: 'Organic & Grounded', swatches: ['#ECFCCB', '#4D7C0F', '#2C4C3B'], match: (theme) => theme.palette === 'earth' || (hueBetween(themePrimary(theme).h, 65, 100) && !isNeutralTheme(theme)) }
        ];

        export const THEME_INDUSTRY_FILTERS = [
            { id: 'all-industries', name: 'All', hint: 'Every Industry', swatches: ['#111111', '#FFFFFF', '#B535F6'], match: () => true },
            { id: 'beauty', name: 'Beauty', hint: 'Salon, Nails, Brows', swatches: ['#FFF1F2', '#EC4899', '#7C2D12'], match: (theme) => hasThemeTag(theme, 'industryTags', ['beauty']) },
            { id: 'wellness', name: 'Wellness', hint: 'Spa, Therapy, Yoga', swatches: ['#ECFDF5', '#10B981', '#064E3B'], match: (theme) => hasThemeTag(theme, 'industryTags', ['wellness']) },
            { id: 'fitness', name: 'Fitness', hint: 'Gyms, Trainers, Sport', swatches: ['#050505', '#39FF14', '#2563EB'], match: (theme) => hasThemeTag(theme, 'industryTags', ['fitness']) },
            { id: 'healthcare', name: 'Healthcare', hint: 'Clinic, Care, Dental', swatches: ['#EFF6FF', '#0EA5E9', '#0F766E'], match: (theme) => hasThemeTag(theme, 'industryTags', ['healthcare']) },
            { id: 'consulting', name: 'Consulting', hint: 'Coaches, Advisors', swatches: ['#F8FAFC', '#2563EB', '#111827'], match: (theme) => hasThemeTag(theme, 'industryTags', ['consulting']) },
            { id: 'creative', name: 'Creative', hint: 'Studios, Artists, Photo', swatches: ['#FAF5FF', '#A855F7', '#DB2777'], match: (theme) => hasThemeTag(theme, 'industryTags', ['creative']) },
            { id: 'events', name: 'Events', hint: 'Venues, DJs, Planners', swatches: ['#111111', '#FACC15', '#BE123C'], match: (theme) => hasThemeTag(theme, 'industryTags', ['events']) },
            { id: 'food', name: 'Food', hint: 'Chefs, Cafes, Tastings', swatches: ['#FFF7ED', '#F97316', '#CA8A04'], match: (theme) => hasThemeTag(theme, 'industryTags', ['food']) },
            { id: 'trades', name: 'Trades', hint: 'Repair, Auto, Home', swatches: ['#FAFAFA', '#F97316', '#111827'], match: (theme) => hasThemeTag(theme, 'industryTags', ['trades']) },
            { id: 'education', name: 'Education', hint: 'Tutors, Classes, Workshops', swatches: ['#F0F9FF', '#2563EB', '#EAB308'], match: (theme) => hasThemeTag(theme, 'industryTags', ['education']) },
            { id: 'retail', name: 'Retail', hint: 'Boutiques, Fittings', swatches: ['#FCE7F3', '#DB2777', '#111827'], match: (theme) => hasThemeTag(theme, 'industryTags', ['retail']) },
            { id: 'hospitality', name: 'Hospitality', hint: 'Hotels, Dining, Tours', swatches: ['#FFFDF8', '#D4AF37', '#111111'], match: (theme) => hasThemeTag(theme, 'industryTags', ['hospitality']) },
            { id: 'property', name: 'Property', hint: 'Real Estate, Rentals', swatches: ['#F8FAFC', '#166534', '#172554'], match: (theme) => hasThemeTag(theme, 'industryTags', ['property']) },
            { id: 'finance', name: 'Finance', hint: 'Bookkeeping, Tax, Wealth', swatches: ['#F9FAFB', '#111827', '#2563EB'], match: (theme) => hasThemeTag(theme, 'industryTags', ['finance']) },
            { id: 'technology', name: 'Technology', hint: 'IT, SaaS, Demos', swatches: ['#020617', '#0EA5E9', '#A855F7'], match: (theme) => hasThemeTag(theme, 'industryTags', ['technology']) }
        ];

        export const THEME_STYLE_FILTERS = [
            { id: 'all-styles', name: 'All', hint: 'Every Style', swatches: ['#FFFFFF', '#111111', '#EC4899'], match: () => true },
            { id: 'modern', name: 'Modern', hint: 'Clean SaaS Polish', swatches: ['#F8FAFC', '#111827', '#2563EB'], match: (theme) => hasThemeTag(theme, 'styleTags', ['modern']) },
            { id: 'minimal', name: 'Minimal', hint: 'Quiet & Airy', swatches: ['#FFFFFF', '#F4F4F5', '#52525B'], match: (theme) => hasThemeTag(theme, 'styleTags', ['minimal']) },
            { id: 'editorial', name: 'Editorial', hint: 'Magazine Serif', swatches: ['#FFFDF9', '#111111', '#D4A373'], match: (theme) => hasThemeTag(theme, 'styleTags', ['editorial']) },
            { id: 'luxury', name: 'Luxury', hint: 'Luxe & Premium', swatches: ['#050505', '#D4AF37', '#FFFFFF'], match: (theme) => hasThemeTag(theme, 'styleTags', ['luxury']) },
            { id: 'bold', name: 'Bold', hint: 'High Impact', swatches: ['#111111', '#FF4FB8', '#39FF14'], match: (theme) => hasThemeTag(theme, 'styleTags', ['bold']) },
            { id: 'night', name: 'Night', hint: 'Dark Mode Brands', swatches: ['#030712', '#111827', '#F8FAFC'], match: (theme) => hasThemeTag(theme, 'styleTags', ['night']) },
            { id: 'organic', name: 'Organic', hint: 'Natural & Calm', swatches: ['#F3F4F1', '#4D7C0F', '#2C4C3B'], match: (theme) => hasThemeTag(theme, 'styleTags', ['organic']) },
            { id: 'tech', name: 'Tech', hint: 'Mono & Digital', swatches: ['#020617', '#0EA5E9', '#A855F7'], match: (theme) => hasThemeTag(theme, 'styleTags', ['tech']) },
            { id: 'commerce', name: 'Commerce', hint: 'Retail Ready', swatches: ['#FFFFFF', '#F97316', '#DB2777'], match: (theme) => hasThemeTag(theme, 'styleTags', ['commerce']) },
            { id: 'handmade', name: 'Handmade', hint: 'Personal & Friendly', swatches: ['#FFFFFF', '#FACC15', '#EC4899'], match: (theme) => hasThemeTag(theme, 'styleTags', ['handmade']) }
        ];

        export const THEME_FILTER_GROUPS = [
            { id: 'palette', name: 'Palette', eyebrow: 'Browse By Palette', filters: THEME_PALETTE_FILTERS },
            { id: 'industry', name: 'Industry', eyebrow: 'Browse By Industry', filters: THEME_INDUSTRY_FILTERS },
            { id: 'style', name: 'Style', eyebrow: 'Browse By Style', filters: THEME_STYLE_FILTERS }
        ];

        export const normalizeHexColor = (color, fallback = '#000000') => {
            if (!color || typeof color !== 'string' || color === 'transparent') return fallback;
            const clean = color.trim();
            if (/^#[0-9a-fA-F]{3}$/.test(clean)) {
                return `#${clean.slice(1).split('').map(char => char + char).join('')}`.toUpperCase();
            }
            if (/^#[0-9a-fA-F]{6}$/.test(clean)) return clean.toUpperCase();
            return fallback;
        };

        export const hexToRgb = (color, fallback = '#000000') => {
            const hex = normalizeHexColor(color, fallback).replace('#', '');
            return {
                r: parseInt(hex.slice(0, 2), 16),
                g: parseInt(hex.slice(2, 4), 16),
                b: parseInt(hex.slice(4, 6), 16)
            };
        };

        export const rgbaFromHex = (color, alpha = 1, fallback = '#000000') => {
            const { r, g, b } = hexToRgb(color, fallback);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };

        export const mixHexColors = (base, overlay, amount = 0.5) => {
            const a = hexToRgb(base, '#FFFFFF');
            const b = hexToRgb(overlay, '#000000');
            const mix = (start, end) => Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
            return `#${mix(a.r, b.r)}${mix(a.g, b.g)}${mix(a.b, b.b)}`.toUpperCase();
        };

        export const readableTextFor = (backgroundColor) => {
            const { r, g, b } = hexToRgb(backgroundColor, '#000000');
            const luminance = [r, g, b].map(value => {
                const c = value / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            });
            const score = 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2];
            return score > 0.58 ? '#000000' : '#FFFFFF';
        };

        export const colorContrastRatio = (foregroundColor, backgroundColor) => {
            const luminanceFor = (color, fallback) => {
                const { r, g, b } = hexToRgb(color, fallback);
                const [red, green, blue] = [r, g, b].map(value => {
                    const c = value / 255;
                    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
            };
            const lighter = Math.max(luminanceFor(foregroundColor, '#000000'), luminanceFor(backgroundColor, '#FFFFFF'));
            const darker = Math.min(luminanceFor(foregroundColor, '#000000'), luminanceFor(backgroundColor, '#FFFFFF'));
            return (lighter + 0.05) / (darker + 0.05);
        };

        export const ensureReadableTextColor = (color, backgroundColor, fallbackColor = readableTextFor(backgroundColor), minContrast = 4.5) => {
            const normalized = normalizeHexColor(color, fallbackColor);
            const background = normalizeHexColor(backgroundColor, '#FFFFFF');
            return colorContrastRatio(normalized, background) >= minContrast ? normalized : fallbackColor;
        };
