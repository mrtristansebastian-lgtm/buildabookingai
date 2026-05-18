import { memo, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Flame, Globe, Instagram, MapPin } from 'lucide-react';
import { getFontFamily } from '../data/fonts';
import { getLocalDateStr } from '../utils/dates';

// --- PUBLIC BOOKING ENGINE (WITH NEW EXTENSIONS & SPECIFIC FONTS) ---
        export const BookingFlow = memo(({ settings, onComplete, isPreview = false, onInspect }) => {
            const [step, setStep] = useState(1);
            const [selectedDateIdx, setSelectedDateIdx] = useState(0);
            const [selectedTime, setSelectedTime] = useState(null);
            const [formData, setFormData] = useState({ name: '', phone: '', email: '', birthday: '' });
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

            const inspectClass = isPreview ? "cursor-pointer hover:ring-1 hover:ring-[#39FF14] hover:ring-offset-4 rounded transition-all duration-300 group/inspect relative" : "";

            const handleAction = () => {
                if (isPreview) { onInspect('copy'); return; }
                if ((selectedTime || isWaitlistMode) && formData.name && formData.phone && formData.email) {
                    onComplete(formData, activeDate.full, isWaitlistMode ? 'Waitlist' : selectedTime, isWaitlistMode ? 'waitlist' : 'pending', activeDate.localDateStr);
                    setStep(2);
                }
            };

            const getDateSlotStyle = (isActive) => {
                const bg = isActive ? (settings.dateActiveBgColor || 'transparent') : (settings.dateBgColor || 'transparent');
                const text = isActive ? (settings.dateActiveTextColor || '#000000') : (settings.dateTextColor || '#666666');
                const radius = settings.buttonStyle === 'pill' ? '32px' : '12px';
                return { backgroundColor: bg, color: text, borderRadius: radius, border: isActive && bg === 'transparent' ? '1px solid transparent' : (bg !== 'transparent' ? 'none' : '1px solid transparent'), fontFamily: getFontFamily(settings.dateFontFamily || settings.fontFamily) };
            };

            const getTimeSlotStyle = (isActive) => {
                const isSolid = settings.availabilityStyle === 'solid';
                const isOutline = settings.availabilityStyle === 'outline';
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
                <div className="w-full h-full flex flex-col transition-all duration-1000 select-none pb-12" style={dynamicStyles}>
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-20 duration-1000 min-h-full flex flex-col p-6 md:p-12 relative z-10">
                    
                    {/* BRAND HEADER */}
                    <header className="mb-10 flex-shrink-0 text-left">
                        <div className={`flex items-center gap-4 mb-8 ${inspectClass}`} onClick={() => isPreview && onInspect('visuals')}>
                            <div className="w-12 h-[2px]" style={{ backgroundColor: settings.primaryColor }} />
                            <span className="text-[9px] font-bold uppercase tracking-[0.6em] opacity-40" style={{ color: settings.bodyColor }}>{settings.tagline}</span>
                        </div>

                        {settings.bannerImage && (
                            <img
                                src={settings.bannerImage}
                                className={`w-full aspect-[16/7] max-h-64 rounded-lg object-cover shadow-sm mb-8 border border-neutral-100/10 ${inspectClass}`}
                                alt="Booking page banner"
                                onClick={() => isPreview && onInspect('identity')}
                            />
                        )}
                        
                        {settings.logo && (
                            <img src={settings.logo} className={`w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover shadow-sm mb-6 border border-neutral-100/10 ${inspectClass}`} alt="Brand Logo" onClick={() => isPreview && onInspect('identity')} />
                        )}

                        <h1 className={`text-5xl md:text-8xl font-bold tracking-tighter mb-4 leading-[0.85] ${inspectClass}`} style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }} onClick={() => isPreview && onInspect('identity')}>
                            {settings.brandName}
                        </h1>
                        <p className={`opacity-60 text-lg md:text-xl font-light leading-relaxed max-sm:text-sm ${inspectClass} mb-4`} style={{ color: settings.bodyColor }} onClick={() => isPreview && onInspect('identity')}>
                            {settings.welcomeMessage}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 mt-4">
                            {settings.address && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ backgroundColor: settings.headingColor + '10', color: settings.headingColor }}>
                                    <MapPin size={12} /> {settings.address}
                                </span>
                            )}
                            {settings.features?.location && (
                                <a href={settings.features.location} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80" style={{ backgroundColor: settings.primaryColor + '20', color: settings.primaryColor }}>
                                    <MapPin size={12} /> Get Directions
                                </a>
                            )}
                            {settings.socials?.instagram && (
                                <a href={`https://instagram.com/${settings.socials.instagram.replace('@','')}`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80" style={{ backgroundColor: settings.headingColor + '10', color: settings.headingColor }}>
                                    <Instagram size={12} /> IG
                                </a>
                            )}
                            {settings.socials?.tiktok && (
                                <a href={`https://www.tiktok.com/@${settings.socials.tiktok.replace('@','')}`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80" style={{ backgroundColor: settings.headingColor + '10', color: settings.headingColor }}>
                                    <Globe size={12} /> TikTok
                                </a>
                            )}
                            {settings.socials?.facebook && (
                                <a href={`https://facebook.com/${settings.socials.facebook.replace('@','')}`} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80" style={{ backgroundColor: settings.headingColor + '10', color: settings.headingColor }}>
                                    <Globe size={12} /> FB
                                </a>
                            )}
                            {settings.socials?.website && (
                                <a href={settings.socials.website} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all hover:opacity-80" style={{ backgroundColor: settings.headingColor + '10', color: settings.headingColor }}>
                                    <Globe size={12} /> Web
                                </a>
                            )}
                        </div>
                    </header>

                    <div className="space-y-16 flex-1">
                        
                        {/* DATE SLIDER */}
                        <section>
                        <div className={`flex items-end justify-between mb-6 px-1 ${inspectClass}`} onClick={() => isPreview && onInspect('copy')}>
                            <div>
                                <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-2 opacity-40" style={{ color: settings.bodyColor }}>01 // {settings.dateLabel || "Which day?"}</h3>
                                <div className="flex items-center gap-4">
                                    <h4 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>
                                        {activeDate.month} <span className="font-light italic opacity-40">{activeDate.year}</span>
                                    </h4>
                                    {settings.features?.firstAvailable && (
                                        <button onClick={handleFirstAvailable} className="px-3 py-1 text-[8px] font-bold uppercase tracking-widest rounded-full transition-all" style={{ backgroundColor: settings.primaryColor, color: settings.buttonTextColor || '#000', fontFamily: getFontFamily(settings.buttonFontFamily || settings.fontFamily) }}>First Available</button>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button className="appearance-none outline-none focus:outline-none w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-20 hover:opacity-100 border" style={{ borderColor: (settings.headingColor || '#000') + '30', color: settings.headingColor }}><ChevronLeft size={14} /></button>
                                <button className="appearance-none outline-none focus:outline-none w-8 h-8 rounded-full flex items-center justify-center transition-all opacity-20 hover:opacity-100 border" style={{ borderColor: (settings.headingColor || '#000') + '30', color: settings.headingColor }}><ChevronRight size={14} /></button>
                            </div>
                        </div>
                        
                        <div className="relative w-full overflow-hidden h-[130px] md:h-[150px]">
                            <div className={`flex gap-3 md:gap-4 overflow-x-auto h-[180px] md:h-[200px] pt-4 px-2 snap-x ${isPreview ? 'cursor-pointer' : ''} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`} onClick={() => isPreview && onInspect('visuals')}>
                                {dates.map((d, i) => {
                                const isActive = selectedDateIdx === i;
                                return (
                                    <button key={i} onClick={() => setSelectedDateIdx(i)} className={`appearance-none outline-none focus:outline-none snap-center flex-shrink-0 w-16 h-[96px] md:w-20 md:h-[112px] flex flex-col items-center justify-center gap-1.5 transition-all duration-500 relative ${isActive ? 'shadow-xl scale-105 z-10' : 'opacity-60 hover:opacity-100'}`} style={getDateSlotStyle(isActive)}>
                                        <span className={`text-[9px] md:text-[10px] font-bold uppercase tracking-[0.3em] transition-all`}>{d.dayName}</span>
                                        <span className={`text-3xl md:text-4xl font-bold tracking-tighter transition-all`}>{d.dayNum}</span>
                                        {settings.availabilityStyle === 'minimal' && isActive && <div className="absolute -bottom-3 w-10 h-[2px] rounded-full" style={{ backgroundColor: settings.primaryColor }} />}
                                    </button>
                                );
                                })}
                            </div>
                        </div>
                        </section>

                        {/* TIME GRID OR WAITLIST */}
                        <section>
                        <div className={`flex flex-col items-start mb-6 px-1 ${inspectClass}`} onClick={() => isPreview && onInspect('copy')}>
                            <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-2 opacity-40" style={{ color: settings.bodyColor }}>02 // {settings.timeLabel || "Select Time"}</h3>
                            <h4 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>
                                {isWaitlistMode ? 'Day Full - Join Waitlist' : 'Available Slots'}
                            </h4>
                        </div>
                        
                        {availableTimesForActiveDate.length === 0 ? (
                            isWaitlistMode ? (
                                <div className="p-8 border border-dashed rounded-lg text-center" style={{ borderColor: settings.primaryColor }}>
                                    <Bell size={24} className="mx-auto mb-4" style={{ color: settings.primaryColor }} />
                                    <p className="text-sm font-bold mb-2" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>Standby List Active</p>
                                    <p className="text-xs opacity-60">Enter your details below. We'll notify you instantly if a slot opens.</p>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm font-bold tracking-widest uppercase opacity-20">Fully Booked</div>
                            )
                        ) : (
                            <div className={`grid grid-cols-3 gap-3 md:gap-4 ${isPreview ? 'cursor-pointer' : ''}`} onClick={() => isPreview && onInspect('availability')}>
                                {availableTimesForActiveDate.map((t) => {
                                const isActive = selectedTime === t;
                                return (
                                    <button key={t} onClick={() => setSelectedTime(t)} className={`appearance-none outline-none focus:outline-none group relative transition-all duration-500 flex items-center justify-center w-full ${settings.availabilityStyle !== 'minimal' ? 'py-4 md:py-5' : 'py-3'} ${settings.availabilityStyle !== 'minimal' && isActive ? 'shadow-xl scale-105 z-10' : ''}`} style={getTimeSlotStyle(isActive)}>
                                        <div className="flex items-center justify-center relative w-full">
                                            <span className={`text-lg md:text-xl font-bold tracking-tighter transition-all duration-500 ${isActive && settings.availabilityStyle === 'minimal' ? '-translate-y-1 scale-110' : ''}`} style={{ fontFeatureSettings: '"tnum" on, "lnum" on' }}>{t}</span>
                                            {settings.availabilityStyle === 'minimal' && isActive && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full shadow-lg" style={{ backgroundColor: settings.primaryColor }} />}
                                        </div>
                                    </button>
                                );
                                })}
                            </div>
                        )}
                        </section>

                        {/* DETAILS FORM */}
                        <section className="pt-10">
                            <div className={`flex flex-col items-start mb-8 px-1 ${inspectClass}`} onClick={() => isPreview && onInspect('copy')}>
                                <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-2 opacity-40" style={{ color: settings.bodyColor }}>03 // {settings.detailsHeading || "Your Details"}</h3>
                                <h4 className="text-xl md:text-2xl font-bold tracking-tight" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>
                                    {isWaitlistMode ? 'Join Standby' : (settings.detailsSubHeading || "Secure Your Slot")}
                                </h4>
                            </div>
                            
                            <div className="space-y-10 px-1">
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity" style={{ color: settings.headingColor }}>Full Name</label>
                                    <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity" style={{ color: settings.headingColor }}>Mobile Number</label>
                                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity" style={{ color: settings.headingColor }}>Email Address</label>
                                    <input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                {settings.features?.birthday && (
                                <div className="group relative">
                                    <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.5em] opacity-40 mb-3 block group-focus-within:opacity-100 transition-opacity flex justify-between" style={{ color: settings.headingColor }}>Birthday <span className="opacity-50 lowercase tracking-normal font-normal">Optional</span></label>
                                    <input type="text" value={formData.birthday} onChange={(e) => setFormData({...formData, birthday: e.target.value})} className="w-full bg-transparent text-2xl md:text-3xl font-bold outline-none tracking-tighter transition-all pb-2" style={{ color: settings.headingColor }} />
                                    <div className="w-full h-[1px] mt-2 group-focus-within:h-[2px] transition-all" style={{ backgroundColor: (settings.headingColor || '#000') + '20' }} />
                                </div>
                                )}
                            </div>
                        </section>

                        {/* FAQs */}
                        {settings.features?.faqs?.length > 0 && (
                        <section className="pt-10 px-1">
                            <h3 className="text-[9px] font-bold uppercase tracking-[0.4em] mb-6 opacity-40" style={{ color: settings.bodyColor }}>FAQ</h3>
                            <div className="space-y-4">
                                {settings.features.faqs.map((faq, i) => (
                                    <div key={i} className="border-b pb-4 cursor-pointer" style={{ borderColor: (settings.headingColor || '#000') + '15' }} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-sm" style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }}>{faq.q}</span>
                                            {openFaq === i ? <ChevronUp size={16} style={{ color: settings.bodyColor }} /> : <ChevronDown size={16} style={{ color: settings.bodyColor }} />}
                                        </div>
                                        {openFaq === i && <p className="mt-3 text-sm opacity-80 leading-relaxed" style={{ color: settings.bodyColor }}>{faq.a}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                        )}

                        <div className="pt-16 pb-12 mt-auto text-center">
                            <button onClick={handleAction} disabled={(!(selectedTime || isWaitlistMode) || !formData.name || !formData.phone || !formData.email) && !isPreview} className={`group relative appearance-none outline-none focus:outline-none w-full py-6 md:py-8 text-xs md:text-sm font-extrabold uppercase tracking-[0.3em] transition-all duration-700 flex items-center justify-center gap-4 overflow-hidden ${(!(selectedTime || isWaitlistMode) || !formData.name || !formData.phone || !formData.email) && !isPreview ? 'opacity-20 grayscale cursor-not-allowed' : 'hover:-translate-y-1 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-95'} ${inspectClass}`} style={{ backgroundColor: settings.primaryColor, color: settings.buttonTextColor || '#000', borderRadius: settings.buttonStyle === 'pill' ? '9999px' : '0px', fontFamily: getFontFamily(settings.buttonFontFamily || settings.fontFamily) }}>
                                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-700 ease-in-out"></div>
                                <span className="relative z-10">{isWaitlistMode ? "Join Waitlist" : (settings.confirmButtonText || "Confirm Booking")}</span> 
                                <ArrowRight size={20} className="relative z-10 transition-transform duration-500 group-hover:translate-x-3" />
                            </button>
                            {settings.features?.socialProof && (
                                <p className="mt-6 text-[10px] font-bold uppercase tracking-widest opacity-40" style={{ color: settings.bodyColor }}><Flame size={12} className="inline mr-1 -mt-0.5"/> 4 People secured slots this week</p>
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
                    <h2 className={`text-7xl md:text-[8rem] font-bold mb-10 tracking-tighter leading-[0.8] ${inspectClass}`} style={{ color: settings.headingColor, fontFamily: getFontFamily(settings.headingFontFamily || settings.fontFamily) }} onClick={() => isPreview && onInspect('copy')}>
                        {isWaitlistMode ? "On The List." : (settings.successHeading || "Confirmed!")}
                    </h2>
                    <p className="opacity-60 text-xl font-light mb-24 max-w-sm leading-relaxed" style={{ color: settings.bodyColor }}>
                        {isWaitlistMode ? `You are on the standby list for ${activeDate.month} ${activeDate.dayNum}. We will text you if a slot opens.` : `Access confirmed for ${selectedTime} on ${activeDate.dayNum} ${activeDate.month}.`}
                    </p>
                    <button onClick={() => setStep(1)} className="appearance-none outline-none focus:outline-none text-[10px] font-bold uppercase tracking-[0.6em] opacity-40 hover:opacity-100 transition-all border-b pb-4" style={{ color: settings.bodyColor, borderColor: settings.bodyColor + '40' }}>New Request</button>
                    </div>
                )}
                </div>
            );
        });
