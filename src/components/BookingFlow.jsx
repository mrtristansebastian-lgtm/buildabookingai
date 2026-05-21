import { memo, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Globe, Instagram, Mail, MapPin } from 'lucide-react';
import { getFontFamily } from '../data/fonts';
import { getLocalDateStr } from '../utils/dates';

const alignments = ['left', 'center', 'right'];
const visualStyles = ['minimal', 'outline', 'solid'];
const clampNumber = (value, min, max, fallback) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
};

const getOptionalLetterSpacing = (value, min, max) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return `${clampNumber(value, min, max, 0)}px`;
};

const getAlign = (value) => alignments.includes(value) ? value : 'left';
const getVisualStyle = (value, fallback = 'minimal') => visualStyles.includes(value) ? value : fallback;
const getBlockMargins = (align) => ({
    marginLeft: align === 'left' ? 0 : 'auto',
    marginRight: align === 'right' ? 0 : 'auto'
});

const normalizeHandle = (value = '') => value.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
const normalizeWebsite = (value = '') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

// --- PUBLIC BOOKING ENGINE (WITH NEW EXTENSIONS & SPECIFIC FONTS) ---
export const BookingFlow = memo(({ settings, onComplete, isPreview = false, onInspect, onInstallApp }) => {
            const [step, setStep] = useState(1);
            const [selectedDateIdx, setSelectedDateIdx] = useState(0);
            const [selectedTime, setSelectedTime] = useState(null);
            const [formData, setFormData] = useState({ name: '', phone: '', email: '', birthday: '', note: '', emailOptIn: false });
            const [isSubmitting, setIsSubmitting] = useState(false);
            const [submitError, setSubmitError] = useState('');
            const [isInitialLoading, setIsInitialLoading] = useState(settings.features?.loadingScreen);
            const [openFaq, setOpenFaq] = useState(null);

            useEffect(() => {
                if (settings.features?.loadingScreen) {
                    setIsInitialLoading(true);
                    const t = setTimeout(() => setIsInitialLoading(false), 1500);
                    return () => clearTimeout(t);
                } else {
                    setIsInitialLoading(false);
                }
            }, [settings.features?.loadingScreen, isPreview]);

            const dates = useMemo(() => {
                const arr = [];
                let d = new Date();
                d.setHours(0,0,0,0);
                let daysChecked = 0;
                while(arr.length < 14 && daysChecked < 365) {
                    const localDateStr = getLocalDateStr(d);
                    const dayConfig = settings.schedule?.[localDateStr];
                    const isAvailable = dayConfig ? dayConfig.available : true;
                    if (isAvailable) {
                        arr.push({ full: d.toDateString(), dayName: d.toLocaleDateString('en-US', { weekday: 'short' }), dayNum: d.getDate(), month: d.toLocaleDateString('en-US', { month: 'long' }), year: d.getFullYear(), localDateStr });
                    }
                    d.setDate(d.getDate() + 1);
                    daysChecked++;
                }
                return arr;
            }, [settings.schedule]);

            useEffect(() => {
                setSelectedDateIdx(0);
                setSelectedTime(null);
            }, [dates]);

            const activeDate = dates[selectedDateIdx] || dates[0];
            
            const availableTimesForActiveDate = useMemo(() => {
                if (!activeDate) return [];
                const dayConfig = settings.schedule?.[activeDate.localDateStr];
                return dayConfig && dayConfig.times ? dayConfig.times : settings.availableTimes;
            }, [activeDate, settings.schedule, settings.availableTimes]);

            const isWaitlistMode = availableTimesForActiveDate.length === 0 && settings.features?.waitlist;
            const collectClientPhone = settings.features?.collectClientPhone !== false;
            const collectClientEmail = settings.features?.collectClientEmail !== false;
            const collectClientNotes = Boolean(settings.features?.collectClientNotes);
            const emailOptInEnabled = Boolean(settings.features?.emailUpdates !== false && collectClientEmail);
            const detailsReady = Boolean(
                formData.name &&
                (!collectClientPhone || formData.phone) &&
                (!collectClientEmail || formData.email)
            );
            const canSubmitBooking = Boolean((selectedTime || isWaitlistMode) && detailsReady);

            useEffect(() => {
                setFormData(prev => ({
                    ...prev,
                    phone: collectClientPhone ? prev.phone : '',
                    email: collectClientEmail ? prev.email : '',
                    note: collectClientNotes ? prev.note : '',
                    emailOptIn: emailOptInEnabled ? prev.emailOptIn : false
                }));
            }, [collectClientEmail, collectClientNotes, collectClientPhone, emailOptInEnabled]);

            const handleFirstAvailable = (e) => {
                e.stopPropagation();
                const nextIdx = dates.findIndex(d => {
                    const dayConfig = settings.schedule?.[d.localDateStr];
                    const times = dayConfig && dayConfig.times ? dayConfig.times : settings.availableTimes;
                    return times.length > 0;
                });
                if (nextIdx !== -1) {
                    setSelectedDateIdx(nextIdx);
                    setSelectedTime(null);
                }
            };

            const dynamicStyles = {
                fontFamily: getFontFamily(settings.bodyFontFamily || settings.fontFamily),
                color: settings.bodyColor || '#666666',
                backgroundColor: settings.backgroundColor || '#ffffff'
            };
            const nativeAccent = Boolean(settings.nativeAccent);
            const nativeAccentFillClass = nativeAccent ? 'booking-gradient-accent' : '';
            const nativeAccentButtonClass = nativeAccent ? 'booking-gradient-button' : '';
            const nativeAccentBorderClass = nativeAccent ? 'booking-gradient-border' : '';
            const nativeAccentCardClass = nativeAccent ? 'booking-gradient-card' : '';

            const inspectClass = isPreview ? "cursor-pointer hover:ring-1 hover:ring-[#39FF14] hover:ring-offset-4 rounded transition-all duration-300 group/inspect relative" : "";
            const logoDisplay = useMemo(() => {
                const display = settings.logoDisplay || {};
                const size = Number(display.size);
                const alignment = ['left', 'center', 'right'].includes(display.alignment) ? display.alignment : 'left';
                return {
                    visible: display.visible !== false,
                    alignment,
                    size: Number.isFinite(size) ? Math.min(176, Math.max(48, size)) : 96
                };
            }, [settings.logoDisplay]);
            const logoAlignmentStyle = {
                justifyContent: logoDisplay.alignment === 'center' ? 'center' : logoDisplay.alignment === 'right' ? 'flex-end' : 'flex-start'
            };
            const pageAlignment = getAlign(logoDisplay.alignment);
            const pageJustify = pageAlignment === 'center' ? 'center' : pageAlignment === 'right' ? 'flex-end' : 'flex-start';
            const pageItems = pageAlignment === 'center' ? 'items-center' : pageAlignment === 'right' ? 'items-end' : 'items-start';
            const pageTextClass = pageAlignment === 'center' ? 'text-center' : pageAlignment === 'right' ? 'text-right' : 'text-left';
            const brandText = {
                size: clampNumber(settings.brandNameSize, 36, 120, 76),
                font: settings.brandNameFontFamily || settings.headingFontFamily || settings.fontFamily
            };
            const taglineText = {
                size: clampNumber(settings.taglineSize, 8, 22, 9),
                font: settings.taglineFontFamily || settings.bodyFontFamily || settings.fontFamily
            };
            const welcomeText = {
                size: clampNumber(settings.welcomeSize, 13, 32, 20),
                font: settings.welcomeFontFamily || settings.bodyFontFamily || settings.fontFamily
            };
            const headingLetterSpacing = getOptionalLetterSpacing(settings.headingLetterSpacing, -4, 8);
            const subtextLetterSpacing = getOptionalLetterSpacing(settings.subtextLetterSpacing, -1, 6);
            const dateStyle = getVisualStyle(settings.dateStyle || settings.availabilityStyle, 'minimal');
            const timeSlotStyle = getVisualStyle(settings.timeSlotStyle || settings.availabilityStyle, 'minimal');
            const actionButtonStyle = getVisualStyle(settings.actionButtonStyle, 'solid');
            const faqStyle = getVisualStyle(settings.faqStyle, 'minimal');
            const socialIconStyle = getVisualStyle(settings.socialIconStyle, 'outline');
            const faqItems = (settings.features?.faqEnabled && Array.isArray(settings.features?.faqs))
                ? settings.features.faqs.filter(faq => faq?.q?.trim() && faq?.a?.trim())
                : [];
            const socialLinks = settings.features?.socialLinks ? [
                settings.socials?.instagram && {
                    key: 'instagram',
                    label: 'Instagram',
                    href: `https://instagram.com/${normalizeHandle(settings.socials.instagram).replace(/^instagram\.com\//i, '')}`,
                    icon: Instagram
                },
                settings.socials?.tiktok && {
                    key: 'tiktok',
                    label: 'TikTok',
                    href: `https://www.tiktok.com/@${normalizeHandle(settings.socials.tiktok).replace(/^tiktok\.com\/@?/i, '')}`,
                    icon: Globe
                },
                settings.socials?.facebook && {
                    key: 'facebook',
                    label: 'Facebook',
                    href: `https://facebook.com/${normalizeHandle(settings.socials.facebook).replace(/^(facebook|fb)\.com\//i, '')}`,
                    icon: Globe
                },
                settings.socials?.website && {
                    key: 'website',
                    label: 'Website',
                    href: normalizeWebsite(settings.socials.website),
                    icon: Globe
                }
            ].filter(Boolean) : [];

            const handleAction = async () => {
                if (isPreview) { onInspect('copy'); return; }
                if (canSubmitBooking) {
                    setIsSubmitting(true);
                    setSubmitError('');
                    try {
                        const completed = await onComplete(
                            {
                                ...formData,
                                phone: collectClientPhone ? formData.phone : '',
                                email: collectClientEmail ? formData.email : '',
                                note: collectClientNotes ? formData.note : '',
                                emailOptIn: Boolean(emailOptInEnabled && formData.emailOptIn)
                            },
                            activeDate.full,
                            isWaitlistMode ? 'Waitlist' : selectedTime,
                            isWaitlistMode ? 'waitlist' : 'pending',
                            activeDate.localDateStr
                        );
                        if (completed === false) {
                            setSubmitError('Booking could not be sent. Please try again.');
                            return;
                        }
                        setStep(2);
                    } catch (error) {
                        console.error(error);
                        setSubmitError('Booking could not be sent. Please try again.');
                    } finally {
                        setIsSubmitting(false);
                    }
                }
            };

            const getDateSlotStyle = (isActive) => {
                const radius = settings.buttonStyle === 'pill' ? '32px' : '12px';
                const activeColor = settings.primaryColor || '#000000';
                const baseTextColor = settings.dateTextColor || '#666666';
                const activeTextColor = settings.dateActiveTextColor || activeColor;
                const activeBg = settings.dateActiveBgColor && settings.dateActiveBgColor !== 'transparent' ? settings.dateActiveBgColor : `${activeColor}18`;
                const baseBg = settings.dateBgColor && settings.dateBgColor !== 'transparent' ? settings.dateBgColor : 'transparent';
                const fontFamily = getFontFamily(settings.dateFontFamily || settings.fontFamily);

                if (dateStyle === 'solid') {
                    return {
                        backgroundColor: isActive ? activeBg : (baseBg === 'transparent' ? `${settings.headingColor || '#000000'}08` : baseBg),
                        color: isActive ? activeTextColor : baseTextColor,
                        borderRadius: radius,
                        border: '1px solid transparent',
                        boxShadow: isActive ? `0 16px 34px -22px ${activeColor}` : 'none',
                        fontFamily
                    };
                }
                if (dateStyle === 'outline') {
                    return {
                        backgroundColor: isActive ? `${activeColor}0D` : 'transparent',
                        color: isActive ? activeColor : baseTextColor,
                        borderRadius: radius,
                        border: `1px solid ${isActive ? activeColor : `${baseTextColor}24`}`,
                        boxShadow: isActive ? `0 12px 28px -24px ${activeColor}` : 'none',
                        fontFamily
                    };
                }
                return {
                    backgroundColor: 'transparent',
                    color: isActive ? activeColor : baseTextColor,
                    borderRadius: '0px',
                    border: '1px solid transparent',
                    fontFamily
                };
            };

            const getTimeSlotStyle = (isActive) => {
                const isSolid = timeSlotStyle === 'solid';
                const isOutline = timeSlotStyle === 'outline';
                const radius = settings.buttonStyle === 'pill' ? '9999px' : '12px';
                const activeColor = settings.primaryColor;
                const baseTextColor = settings.slotTextColor || '#000000';
                const fontF = getFontFamily(settings.slotFontFamily || settings.fontFamily);

                if (isSolid) {
                    return { backgroundColor: isActive ? activeColor : (settings.slotBgColor || '#f5f5f5'), color: isActive ? '#000000' : baseTextColor, borderRadius: radius, border: '1px solid transparent', boxShadow: isActive ? `0 10px 30px -10px ${activeColor}80` : 'none', fontFamily: fontF };
                }
                if (isOutline) {
                    return { backgroundColor: isActive ? activeColor + '0D' : 'transparent', color: isActive ? activeColor : baseTextColor, borderRadius: radius, border: `1px solid ${isActive ? activeColor : baseTextColor + '20'}`, fontFamily: fontF };
                }
                return { backgroundColor: 'transparent', color: isActive ? activeColor : baseTextColor, border: '1px solid transparent', borderRadius: '0px', fontFamily: fontF };
            };

            const getActionButtonStyle = () => {
                const radius = settings.buttonStyle === 'pill' ? '9999px' : '8px';
                const accent = settings.primaryColor || '#000000';
                const textColor = settings.buttonTextColor || '#000000';
                const fontFamily = getFontFamily(settings.buttonFontFamily || settings.fontFamily);
                if (actionButtonStyle === 'outline') {
                    return { backgroundColor: 'transparent', color: accent, border: `1px solid ${accent}`, borderRadius: radius, fontFamily };
                }
                if (actionButtonStyle === 'minimal') {
                    return { backgroundColor: 'transparent', color: settings.headingColor || accent, border: '1px solid transparent', borderBottom: `2px solid ${accent}`, borderRadius: '0px', boxShadow: 'none', fontFamily };
                }
                return { backgroundColor: accent, color: textColor, border: '1px solid transparent', borderRadius: radius, fontFamily };
            };

            const getFaqItemStyle = () => {
                const bg = settings.faqBgColor || 'transparent';
                const borderColor = settings.faqBorderColor || `${settings.headingColor || '#000000'}18`;
                if (faqStyle === 'solid') return { backgroundColor: bg === 'transparent' ? `${settings.headingColor || '#000000'}08` : bg, border: '1px solid transparent', borderRadius: '16px', padding: '18px' };
                if (faqStyle === 'outline') return { backgroundColor: 'transparent', border: `1px solid ${borderColor}`, borderRadius: '16px', padding: '18px' };
                return { backgroundColor: 'transparent', borderBottom: `1px solid ${borderColor}`, borderRadius: '0px', paddingBottom: '16px' };
            };

            const getSocialLinkStyle = () => {
                const accent = settings.socialIconColor || settings.primaryColor || settings.headingColor || '#000000';
                const bg = settings.socialIconBgColor || 'transparent';
                if (socialIconStyle === 'solid') return { backgroundColor: bg === 'transparent' ? accent : bg, color: settings.socialIconTextColor || settings.buttonTextColor || '#000000', border: '1px solid transparent' };
                if (socialIconStyle === 'outline') return { backgroundColor: 'transparent', color: accent, border: `1px solid ${accent}55` };
                return { backgroundColor: 'transparent', color: accent, border: '1px solid transparent' };
            };

            if (isInitialLoading) {
                return (
                    <div className="absolute inset-0 z-50 flex items-center justify-center transition-opacity duration-1000" style={{ backgroundColor: settings.backgroundColor }}>
                        <div className="w-24 h-24 rounded-full flex items-center justify-center font-bold text-5xl shadow-2xl animate-subtle-pulse" style={{ backgroundColor: settings.headingColor, color: settings.backgroundColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>
                            {settings.brandName?.charAt(0) || "B"}
                        </div>
                    </div>
                );
            }

            if (!activeDate) return <div className="h-full w-full flex items-center justify-center font-bold text-xl opacity-20">No Availability</div>;

            return (
                <div className={`w-full h-full flex flex-col transition-all duration-1000 select-none pb-12 ${nativeAccent ? 'native-booking-theme' : ''}`} style={dynamicStyles}>
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-20 duration-1000 min-h-full flex flex-col p-6 md:p-12 relative z-10">
                    
                    {/* BRAND HEADER */}
                    <header className="mb-10 flex-shrink-0">
                        <div
                            className={`flex items-center gap-4 mb-8 ${inspectClass}`}
                            style={{ justifyContent: pageJustify }}
                            onClick={() => isPreview && onInspect('visuals')}
                        >
                            <div className={`w-12 h-[2px] ${nativeAccentFillClass}`} style={{ backgroundColor: settings.primaryColor }} />
                            <span
                                className="font-bold uppercase tracking-[0.6em] opacity-40"
                                style={{ color: settings.bodyColor, fontFamily: getFontFamily(taglineText.font), fontSize: `${taglineText.size}px`, textAlign: pageAlignment, ...(subtextLetterSpacing ? { letterSpacing: subtextLetterSpacing } : {}) }}
                            >
                                {settings.tagline}
                            </span>
                        </div>

                        {settings.bannerImage && (
                            <img
                                src={settings.bannerImage}
                                className={`w-full aspect-[16/7] max-h-64 rounded-lg object-cover shadow-sm mb-8 border border-neutral-100/10 ${inspectClass}`}
                                alt="Booking page banner"
                                onClick={() => isPreview && onInspect('identity')}
                            />
                        )}
                        
                        {settings.logo && logoDisplay.visible && (
                            <div className="flex mb-6" style={logoAlignmentStyle}>
                                <img
                                    src={settings.logo}
                                    className={`rounded-lg object-contain shadow-sm border border-neutral-100/10 ${inspectClass}`}
                                    style={{ width: logoDisplay.size, height: logoDisplay.size, maxWidth: '45vw', maxHeight: '45vw' }}
                                    alt="Brand Logo"
                                    onClick={() => isPreview && onInspect('identity')}
                                />
                            </div>
                        )}

                        <h1
                            className={`font-bold tracking-tighter mb-4 leading-[0.85] max-w-full ${inspectClass}`}
                            style={{
                                color: settings.headingColor,
                                fontFamily: getFontFamily(brandText.font),
                                fontSize: `${brandText.size}px`,
                                ...(headingLetterSpacing ? { letterSpacing: headingLetterSpacing } : {}),
                                textAlign: pageAlignment,
                                overflowWrap: 'anywhere',
                                ...getBlockMargins(pageAlignment)
                            }}
                            onClick={() => isPreview && onInspect('identity')}
                        >
                            {settings.brandName}
                        </h1>
                        <p
                            className={`opacity-60 font-light leading-relaxed max-w-3xl ${inspectClass} mb-4`}
                            style={{
                                color: settings.bodyColor,
                                fontFamily: getFontFamily(welcomeText.font),
                                fontSize: `${welcomeText.size}px`,
                                ...(subtextLetterSpacing ? { letterSpacing: subtextLetterSpacing } : {}),
                                textAlign: pageAlignment,
                                ...getBlockMargins(pageAlignment)
                            }}
                            onClick={() => isPreview && onInspect('identity')}
                        >
                            {settings.welcomeMessage}
                        </p>

                        <div
                            className="flex flex-wrap items-center gap-3 mt-4"
                            style={{ justifyContent: pageJustify }}
                        >
                            {settings.address && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: settings.headingColor + '10', color: settings.headingColor }}>
                                    <MapPin size={12} /> {settings.address}
                                </span>
                            )}
                            {settings.features?.location && (
                                <a href={settings.features.location} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80 ${nativeAccent ? 'booking-gradient-chip' : ''}`} style={{ backgroundColor: settings.primaryColor + '20', color: settings.primaryColor }}>
                                    <MapPin size={12} /> Get Directions
                                </a>
                            )}
                        </div>
                    </header>

                    <div className="space-y-16 flex-1">
                        
                        {/* DATE SLIDER */}
                        <section>
                        <div className={`flex ${pageAlignment === 'left' ? 'items-end justify-between' : `flex-col ${pageItems} gap-4`} mb-6 px-1 ${inspectClass}`} onClick={() => isPreview && onInspect('copy')}>
                            <div className={`flex flex-col ${pageItems} ${pageTextClass}`}>
                                <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-2 opacity-40" style={{ color: settings.bodyColor }}>01 // {settings.dateLabel || "Which day?"}</h3>
                                <div className="flex flex-wrap items-center gap-4" style={{ justifyContent: pageJustify }}>
                                    <h4 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily), ...(headingLetterSpacing ? { letterSpacing: headingLetterSpacing } : {}) }}>
                                        {activeDate.month} <span className="font-light italic opacity-40">{activeDate.year}</span>
                                    </h4>
                                    {settings.features?.firstAvailable && (
                                        <button onClick={handleFirstAvailable} className={`px-3 py-1 text-[8px] font-bold uppercase tracking-widest rounded-full transition-all ${nativeAccentButtonClass}`} style={{ backgroundColor: settings.primaryColor, color: settings.buttonTextColor || '#000', fontFamily: getFontFamily(settings.buttonFontFamily || settings.fontFamily) }}>First Available</button>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2" style={{ justifyContent: pageJustify }}>
                                <button className="appearance-none outline-none focus:outline-none w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-20 hover:opacity-100 border" style={{ borderColor: (settings.headingColor || '#000') + '30', color: settings.headingColor }}><ChevronLeft size={14} /></button>
                                <button className="appearance-none outline-none focus:outline-none w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-20 hover:opacity-100 border" style={{ borderColor: (settings.headingColor || '#000') + '30', color: settings.headingColor }}><ChevronRight size={14} /></button>
                            </div>
                        </div>
                        
                        <div className="relative w-full overflow-hidden h-[130px] md:h-[150px]">
                            <div className={`flex gap-3 md:gap-4 overflow-x-auto h-[180px] md:h-[200px] pt-4 px-2 snap-x ${isPreview ? 'cursor-pointer' : ''} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`} onClick={() => isPreview && onInspect('visuals')}>
                                {dates.map((d, i) => {
                                const isActive = selectedDateIdx === i;
                                const nativeDateClass = nativeAccent && isActive
                                    ? (dateStyle === 'solid' ? nativeAccentButtonClass : `${nativeAccentCardClass} ${nativeAccentBorderClass}`)
                                    : '';
                                return (
                                    <button key={i} onClick={() => setSelectedDateIdx(i)} className={`appearance-none outline-none focus:outline-none snap-center flex-shrink-0 w-16 h-[96px] md:w-20 md:h-[112px] flex flex-col items-center justify-center gap-1.5 transition-all duration-500 relative ${isActive ? 'shadow-xl scale-105 z-10' : 'opacity-60 hover:opacity-100'} ${nativeDateClass}`} style={getDateSlotStyle(isActive)}>
                                        <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] transition-all`}>{d.dayName}</span>
                                        <span className={`text-3xl md:text-4xl font-bold tracking-tighter transition-all`}>{d.dayNum}</span>
                                        {dateStyle === 'minimal' && isActive && <div className={`absolute -bottom-3 w-10 h-[2px] rounded-full ${nativeAccentFillClass}`} style={{ backgroundColor: settings.primaryColor }} />}
                                    </button>
                                );
                                })}
                            </div>
                        </div>
                        </section>

                        {/* TIME GRID OR WAITLIST */}
                        <section>
                        <div className={`flex flex-col ${pageItems} ${pageTextClass} mb-6 px-1 ${inspectClass}`} onClick={() => isPreview && onInspect('copy')}>
                            <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-2 opacity-40" style={{ color: settings.bodyColor }}>02 // {settings.timeLabel || "Select Time"}</h3>
                            <h4 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily), ...(headingLetterSpacing ? { letterSpacing: headingLetterSpacing } : {}) }}>
                                {isWaitlistMode ? 'Day Full - Join Waitlist' : 'Available Slots'}
                            </h4>
                        </div>
                        
                        {availableTimesForActiveDate.length === 0 ? (
                            isWaitlistMode ? (
                                <div className={`p-8 border border-dashed rounded-lg text-center ${nativeAccentBorderClass}`} style={{ borderColor: settings.primaryColor }}>
                                    <Bell size={24} className="mx-auto mb-4" style={{ color: settings.primaryColor }} />
                                    <p className="text-sm font-bold mb-2" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>Standby List Active</p>
                                    <p className="text-xs opacity-60">Enter your details below. We'll notify you instantly if a slot opens.</p>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm font-bold tracking-widest uppercase opacity-20">Fully Booked</div>
                            )
                        ) : (
                            <div className={`grid grid-cols-3 gap-3 md:gap-4 ${isPreview ? 'cursor-pointer' : ''}`} onClick={() => isPreview && onInspect('visuals')}>
                                {availableTimesForActiveDate.map((t) => {
                                const isActive = selectedTime === t;
                                const nativeTimeClass = nativeAccent && isActive
                                    ? (timeSlotStyle === 'solid' ? nativeAccentButtonClass : nativeAccentBorderClass)
                                    : '';
                                return (
                                    <button key={t} onClick={() => setSelectedTime(t)} className={`appearance-none outline-none focus:outline-none group relative transition-all duration-500 flex items-center justify-center w-full ${timeSlotStyle !== 'minimal' ? 'py-4 md:py-5' : 'py-3'} ${timeSlotStyle !== 'minimal' && isActive ? 'shadow-xl scale-105 z-10' : ''} ${nativeTimeClass}`} style={getTimeSlotStyle(isActive)}>
                                        <div className="flex items-center justify-center relative w-full">
                                            <span className={`text-lg md:text-xl font-bold tracking-tighter transition-all duration-500 ${isActive && timeSlotStyle === 'minimal' ? '-translate-y-1 scale-110' : ''}`} style={{ fontFeatureSettings: '"tnum" on, "lnum" on' }}>{t}</span>
                                            {timeSlotStyle === 'minimal' && isActive && <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full shadow-lg ${nativeAccentFillClass}`} style={{ backgroundColor: settings.primaryColor }} />}
                                        </div>
                                    </button>
                                );
                                })}
                            </div>
                        )}
                        </section>

                        {/* DETAILS FORM */}
                        <section className="pt-10">
                            <div className={`flex flex-col ${pageItems} ${pageTextClass} mb-8 px-1 ${inspectClass}`} onClick={() => isPreview && onInspect('copy')}>
                                <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-2 opacity-40" style={{ color: settings.bodyColor }}>03 // {settings.detailsHeading || "Your Details"}</h3>
                                <h4 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily), ...(headingLetterSpacing ? { letterSpacing: headingLetterSpacing } : {}) }}>
                                    {isWaitlistMode ? 'Join Standby' : (settings.detailsSubHeading || "Secure Your Slot")}
                                </h4>
                            </div>
                            
                            <div className="space-y-10 px-1">
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity" style={{ color: settings.headingColor }}>Full Name</label>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                {collectClientPhone && (
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity" style={{ color: settings.headingColor }}>Mobile Number</label>
                                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                )}
                                {faqItems.length > 0 && (
                                <div className={`pt-2 ${inspectClass}`} onClick={() => isPreview && onInspect('features')}>
                                    <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-5 opacity-40" style={{ color: settings.bodyColor }}>Questions</h3>
                                    <div className="space-y-3">
                                        {faqItems.map((faq, i) => (
                                            <button
                                                key={`${faq.q}-${i}`}
                                                type="button"
                                                className="w-full text-left transition-all"
                                                style={getFaqItemStyle()}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setOpenFaq(openFaq === i ? null : i);
                                                }}
                                            >
                                                <span className="flex justify-between items-center gap-4">
                                                    <span className="font-bold text-sm" style={{ color: settings.faqTextColor || settings.headingColor, fontFamily: getFontFamily(settings.faqFontFamily || settings.headingFontFamily || settings.fontFamily) }}>{faq.q}</span>
                                                    {openFaq === i ? <ChevronUp size={16} style={{ color: settings.faqAnswerColor || settings.bodyColor }} /> : <ChevronDown size={16} style={{ color: settings.faqAnswerColor || settings.bodyColor }} />}
                                                </span>
                                                {openFaq === i && <span className="block mt-3 text-sm opacity-85 leading-relaxed" style={{ color: settings.faqAnswerColor || settings.bodyColor, fontFamily: getFontFamily(settings.faqFontFamily || settings.bodyFontFamily || settings.fontFamily) }}>{faq.a}</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                )}
                                {collectClientEmail && (
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity" style={{ color: settings.headingColor }}>Email Address</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                )}
                                {collectClientNotes && (
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity flex justify-between" style={{ color: settings.headingColor }}>Booking Note <span className="opacity-50 lowercase tracking-normal font-normal">Optional</span></label>
                                    <textarea value={formData.note} onChange={(e) => setFormData({...formData, note: e.target.value})} rows={3} className="w-full bg-transparent text-xl md:text-2xl font-bold outline-none tracking-tight transition-all pb-2 resize-none" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                )}
                                {settings.features?.birthday && (
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity flex justify-between" style={{ color: settings.headingColor }}>Birthday <span className="opacity-50 lowercase tracking-normal font-normal">Optional</span></label>
                                    <input type="text" value={formData.birthday} onChange={(e) => setFormData({...formData, birthday: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                )}
                            </div>
                        </section>

                        <div className="pt-16 pb-12 mt-auto text-center">
                            {emailOptInEnabled && (
                                <label
                                    className={`mb-5 flex items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-all ${inspectClass}`}
                                    style={{
                                        borderColor: `${settings.headingColor || '#000000'}18`,
                                        backgroundColor: `${settings.headingColor || '#000000'}08`
                                    }}
                                    onClick={(event) => {
                                        if (isPreview) {
                                            event.preventDefault();
                                            onInspect('features');
                                        }
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={Boolean(formData.emailOptIn)}
                                        onChange={(event) => setFormData({ ...formData, emailOptIn: event.target.checked })}
                                        className="sr-only"
                                    />
                                    <span
                                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-all ${formData.emailOptIn ? nativeAccentFillClass : ''}`}
                                        style={{
                                            backgroundColor: formData.emailOptIn ? (settings.primaryColor || '#39FF14') : 'transparent',
                                            borderColor: formData.emailOptIn ? (settings.primaryColor || '#39FF14') : `${settings.headingColor || '#000000'}35`,
                                            color: settings.buttonTextColor || '#000000'
                                        }}
                                    >
                                        {formData.emailOptIn && <Check size={14} strokeWidth={4} />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.25em]" style={{ color: settings.headingColor }}>
                                            <Mail size={13} /> Email updates
                                        </span>
                                        <span className="mt-1 block text-xs leading-relaxed opacity-60" style={{ color: settings.bodyColor }}>
                                            Send booking confirmations, schedule changes, and helpful updates to the email entered above.
                                        </span>
                                    </span>
                                </label>
                            )}
                            <div
                                className="mb-5 rounded-2xl border px-4 py-3.5 md:py-4 text-left"
                                style={{
                                    borderColor: `${settings.headingColor || '#000000'}12`,
                                    backgroundColor: `${settings.headingColor || '#000000'}05`
                                }}
                            >
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.28em] mb-2" style={{ color: settings.headingColor }}>
                                    What happens next
                                </p>
                                <p className="text-xs leading-relaxed opacity-60" style={{ color: settings.bodyColor }}>
                                    Send the request and the business will review it. After that, Build A Booking keeps your updates, reschedule requests, and messages with this business in one simple place.
                                </p>
                            </div>
                            <div
                                className="mb-5 rounded-2xl border px-4 py-4 text-left"
                                style={{
                                    borderColor: `${settings.primaryColor || settings.headingColor || '#000000'}22`,
                                    backgroundColor: `${settings.primaryColor || settings.headingColor || '#000000'}0A`
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <span
                                        className={`mt-0.5 flex h-8 w-8 md:h-9 md:w-9 shrink-0 items-center justify-center rounded-xl ${nativeAccentFillClass}`}
                                        style={{ backgroundColor: settings.primaryColor || settings.headingColor || '#000000', color: settings.buttonTextColor || '#000000' }}
                                    >
                                        <Bell size={15} />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-[10px] font-extrabold uppercase tracking-[0.26em]" style={{ color: settings.headingColor }}>Your Booking Companion</span>
                                        <span className="mt-1 block text-xs leading-relaxed opacity-60" style={{ color: settings.bodyColor }}>
                                            Add the app or open the client portal to track your booking, get updates, ask for changes, and chat with the place you booked with.
                                        </span>
                                    </span>
                                </div>
                                {!isPreview && (
                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => { window.location.href = `${window.location.origin}/#/client`; }}
                                            className="h-10 rounded-full border text-[9px] font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5"
                                            style={{ borderColor: `${settings.headingColor || '#000000'}20`, color: settings.headingColor, backgroundColor: settings.backgroundColor || '#ffffff' }}
                                        >
                                            Client Portal
                                        </button>
                                        {onInstallApp && (
                                            <button
                                                type="button"
                                                onClick={onInstallApp}
                                                className={`h-10 rounded-full text-[9px] font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5 ${nativeAccentButtonClass}`}
                                                style={{ backgroundColor: settings.primaryColor || settings.headingColor || '#000000', color: settings.buttonTextColor || '#000000' }}
                                            >
                                                Add App
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            {submitError && (
                                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-red-500">{submitError}</p>
                            )}
                            <button onClick={handleAction} disabled={(isSubmitting || !canSubmitBooking) && !isPreview} className={`group relative appearance-none outline-none focus:outline-none w-full py-6 md:py-8 text-xs md:text-sm font-extrabold uppercase tracking-[0.3em] transition-all duration-700 flex items-center justify-center gap-4 overflow-hidden ${(isSubmitting || !canSubmitBooking) && !isPreview ? 'opacity-20 grayscale cursor-not-allowed' : actionButtonStyle === 'minimal' ? 'hover:opacity-70 active:scale-95' : 'hover:-translate-y-1 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-95'} ${nativeAccentButtonClass} ${inspectClass}`} style={getActionButtonStyle()}>
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-in-out"></div>
                                <span className="relative z-10">{isSubmitting ? 'Sending Request' : isWaitlistMode ? "Join Waitlist" : (settings.confirmButtonText || "Confirm Booking")}</span>
                                <ArrowRight size={20} className="relative z-10 transition-transform duration-500 group-hover:translate-x-3" />
                            </button>
                            {settings.features?.socialProof && (
                                <p className="mt-6 text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: settings.bodyColor }}><Flame size={12} className="inline mr-1 -mt-0.5"/> 4 People secured slots this week</p>
                            )}
                            {socialLinks.length > 0 && (
                                <div className={`mt-8 flex flex-wrap items-center justify-center gap-3 ${inspectClass}`} onClick={() => isPreview && onInspect('features')}>
                                    {socialLinks.map(link => {
                                        const IconCmp = link.icon;
                                        return (
                                            <a
                                                key={link.key}
                                                href={link.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(event) => {
                                                    if (isPreview) {
                                                        event.preventDefault();
                                                        onInspect('features');
                                                    }
                                                }}
                                                className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-4 text-[10px] font-bold uppercase tracking-widest transition-all hover:-translate-y-0.5"
                                                style={getSocialLinkStyle()}
                                                aria-label={link.label}
                                            >
                                                <IconCmp size={14} />
                                                <span>{link.label}</span>
                                            </a>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="h-full flex flex-col items-start justify-center text-left animate-in zoom-in-95 duration-1000 p-8 md:p-16 relative z-10">
                    <div className={`flex items-center gap-8 mb-20 ${inspectClass}`} onClick={() => isPreview && onInspect('visuals')}>
                        <div className="w-20 h-20 rounded-lg flex items-center justify-center shadow-2xl rotate-12" style={{ backgroundColor: settings.headingColor }}>
                        {isWaitlistMode ? <Bell size={32} strokeWidth={3} style={{ color: settings.primaryColor }} /> : <Check size={40} strokeWidth={4} style={{ color: settings.primaryColor }} />}
                        </div>
                        <div><p className="text-[10px] font-bold uppercase tracking-[0.5em] opacity-40" style={{ color: settings.bodyColor }}>Booking Status</p><p className="text-lg font-bold uppercase tracking-[0.2em]" style={{ color: settings.headingColor }}>{isWaitlistMode ? 'Standby' : 'Confirmed'}</p></div>
                    </div>
                    <h2 className={`text-7xl md:text-[8rem] font-bold mb-10 tracking-tighter leading-[0.8] ${inspectClass}`} style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily), ...(headingLetterSpacing ? { letterSpacing: headingLetterSpacing } : {}) }} onClick={() => isPreview && onInspect('copy')}>
                        {isWaitlistMode ? "On The List." : (settings.successHeading || "Confirmed!")}
                    </h2>
                    <p className="opacity-60 text-xl font-light mb-24 max-w-sm leading-relaxed" style={{ color: settings.bodyColor, ...(subtextLetterSpacing ? { letterSpacing: subtextLetterSpacing } : {}) }}>
                        {isWaitlistMode ? `You are on the standby list for ${activeDate.month} ${activeDate.dayNum}. We will text you if a slot opens.` : `Access confirmed for ${selectedTime} on ${activeDate.dayNum} ${activeDate.month}.`}
                    </p>
                    <div className="mb-12 grid w-full max-w-lg grid-cols-1 gap-3 md:grid-cols-3">
                        {[
                            ['Saved', 'Your request is in the system.'],
                            ['Reviewed', 'The team can confirm or follow up.'],
                            ['App', 'Use Build A Booking to manage updates, reschedules, and chat.']
                        ].map(([title, copy]) => (
                            <div key={title} className="rounded-2xl border p-4" style={{ borderColor: `${settings.headingColor || '#000000'}12`, backgroundColor: `${settings.headingColor || '#000000'}05` }}>
                                <p className="text-[10px] font-extrabold uppercase tracking-[0.25em]" style={{ color: settings.headingColor }}>{title}</p>
                                <p className="mt-2 text-xs leading-relaxed opacity-55" style={{ color: settings.bodyColor }}>{copy}</p>
                            </div>
                        ))}
                    </div>
                    {(formData.email || onInstallApp) && !isPreview && (
                        <div className="mb-8 flex flex-col sm:flex-row gap-3">
                            {formData.email && (
                                <button
                                    onClick={() => { window.location.href = `${window.location.origin}/#/client`; }}
                                    className="appearance-none outline-none focus:outline-none px-7 py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] border transition-all hover:-translate-y-0.5"
                                    style={{ borderColor: settings.headingColor + '22', color: settings.headingColor, backgroundColor: settings.headingColor + '05' }}
                                >
                                    Open Client Portal
                                </button>
                            )}
                            {onInstallApp && (
                                <button
                                    onClick={onInstallApp}
                                    className="appearance-none outline-none focus:outline-none px-7 py-4 rounded-full text-[10px] font-bold uppercase tracking-[0.3em] transition-all hover:-translate-y-0.5"
                                    style={{ color: settings.buttonTextColor || '#000000', backgroundColor: settings.primaryColor || settings.headingColor || '#000000' }}
                                >
                                    Add Mobile App
                                </button>
                            )}
                        </div>
                    )}
                    <button onClick={() => setStep(1)} className="appearance-none outline-none focus:outline-none text-[10px] font-bold uppercase tracking-[0.6em] opacity-40 hover:opacity-100 transition-all border-b pb-4" style={{ color: settings.bodyColor, borderColor: settings.bodyColor + '40' }}>New Request</button>
                    </div>
                )}
                </div>
            );
        });
