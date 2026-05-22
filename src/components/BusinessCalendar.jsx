import { useEffect, useMemo, useState } from 'react';
import { CalendarCheck, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock, Plus, RefreshCw, ShieldCheck, Users, X, XCircle } from 'lucide-react';
import { getLocalDateStr } from '../utils/dates';

// --- CALENDAR ENGINE (Business Settings) ---
        export const BusinessCalendar = ({
            settings,
            setSettings,
            onSave,
            showToast,
            bookings = [],
            clientDirectory = [],
            staffList = [],
            activeStaffId = 'owner',
            workspaceRole = 'owner',
            googleCalendarState = {},
            onConnectGoogleCalendar,
            onSyncGoogleCalendar
        }) => {
            const [currentMonth, setCurrentMonth] = useState(new Date());
            const [expandedDate, setExpandedDate] = useState(getLocalDateStr(new Date()));
            const [isAddingSlot, setIsAddingSlot] = useState(false);
            const [newSlotTime, setNewSlotTime] = useState('18:00');
            const [isAddingDefaultSlot, setIsAddingDefaultSlot] = useState(false);
            const [defaultSlotTime, setDefaultSlotTime] = useState('12:00');
            const [scheduleStatsPeriod, setScheduleStatsPeriod] = useState('month');
            const initialCalendarId = workspaceRole === 'staff' ? (activeStaffId || 'owner') : 'workspace';
            const [selectedCalendarId, setSelectedCalendarId] = useState(initialCalendarId);
            const [calendarViewMode, setCalendarViewMode] = useState(() => (
                typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches ? 'week' : 'month'
            ));
            const [hidePastDays, setHidePastDays] = useState(true);
            const [isMobilePortraitCalendar, setIsMobilePortraitCalendar] = useState(() => (
                typeof window !== 'undefined' && window.matchMedia?.('(max-width: 767px) and (orientation: portrait)')?.matches
            ));
            useEffect(() => {
                if (workspaceRole === 'staff' && activeStaffId) setSelectedCalendarId(activeStaffId);
            }, [activeStaffId, workspaceRole]);
            const getStaffDisplayName = (staff = {}) => staff.name || staff.displayName || staff.email?.split('@')[0] || 'Team member';
            const getStaffUsername = (staff = {}) => staff.username || staff.handle || (staff.email ? `@${staff.email.split('@')[0]}` : `${staff.role || 'staff'} calendar`);
            const getStaffInitials = (name = 'Team member') => name.split(' ').map(part => part.charAt(0)).join('').slice(0, 2).toUpperCase();
            const normalizeEmailKey = (value = '') => String(value || '').trim().toLowerCase();
            const normalizePhoneKey = (value = '') => String(value || '').replace(/\D/g, '');
            const getBookingClientProfile = (booking = {}) => {
                const emailKey = normalizeEmailKey(booking.clientEmail || booking.email || '');
                const phoneKey = normalizePhoneKey(booking.clientPhone || booking.phone || '');
                const nameKey = String(booking.clientName || '').trim().toLowerCase();
                return clientDirectory.find(client => (
                    (emailKey && normalizeEmailKey(client.email || '') === emailKey) ||
                    (phoneKey && normalizePhoneKey(client.phone || '') === phoneKey) ||
                    (nameKey && String(client.name || '').trim().toLowerCase() === nameKey)
                )) || null;
            };
            const getBookingClientAvatar = (booking = {}) => (
                booking.clientPhotoURL ||
                booking.clientAvatar ||
                booking.avatar ||
                getBookingClientProfile(booking)?.avatar ||
                ''
            );
            const staffMembersForCoverage = useMemo(() => {
                const activeStaff = (staffList || []).filter(staff => staff?.id && staff.accessEnabled !== false);
                const fallbackStaff = [{ id: activeStaffId || 'owner', name: workspaceRole === 'staff' ? 'My Calendar' : 'Owner', role: workspaceRole === 'staff' ? 'staff' : 'owner', color: '#000000' }];
                return (activeStaff.length ? activeStaff : fallbackStaff)
                    .filter((staff, index, list) => staff?.id && list.findIndex(item => item.id === staff.id) === index);
            }, [activeStaffId, staffList, workspaceRole]);
            const staffCalendarOptions = useMemo(() => {
                return [
                    { id: 'workspace', name: 'Business Overview', role: `${staffMembersForCoverage.length} ${staffMembersForCoverage.length === 1 ? 'profile' : 'profiles'}`, color: '#000000', username: 'full business view', icon: 'business' },
                    ...staffMembersForCoverage.map(staff => ({
                        id: staff.id,
                        name: getStaffDisplayName(staff),
                        role: staff.role === 'owner' ? 'Owner' : staff.role === 'admin' ? 'Admin' : 'Staff',
                        username: getStaffUsername(staff),
                        color: staff.color || '#39FF14',
                        photoURL: staff.photoURL || ''
                    }))
                ].filter((calendar, index, list) => calendar.id && list.findIndex(item => item.id === calendar.id) === index);
            }, [staffMembersForCoverage]);
            const selectedCalendar = staffCalendarOptions.find(calendar => calendar.id === selectedCalendarId) || staffCalendarOptions[0];
            const visibleCalendarOptions = staffCalendarOptions;
            const isWorkspaceCalendar = selectedCalendarId === 'workspace';
            const isAggregateCalendar = selectedCalendarId === 'all-staff';
            const isSingleStaffCalendar = !isWorkspaceCalendar && !isAggregateCalendar;
            const activeStaffCalendar = isSingleStaffCalendar ? (settings.staffCalendars?.[selectedCalendarId] || {}) : null;
            const activeSchedule = isSingleStaffCalendar ? (activeStaffCalendar?.schedule || {}) : (settings.schedule || {});
            const canEditSelectedCalendar = !isAggregateCalendar && (workspaceRole !== 'staff' || selectedCalendarId === activeStaffId);
            const readOnlyCalendarMessage = isWorkspaceCalendar
                ? 'Business overview is view only for staff. Switch to your own calendar to edit availability.'
                : 'You can view teammate calendars, but only edit your own availability.';
            useEffect(() => {
                if (!staffCalendarOptions.some(calendar => calendar.id === selectedCalendarId)) {
                    setSelectedCalendarId(workspaceRole === 'staff' ? (activeStaffId || 'workspace') : 'workspace');
                }
            }, [activeStaffId, selectedCalendarId, staffCalendarOptions, workspaceRole]);
            const businessDefaultTimes = Array.isArray(settings.availableTimes) ? settings.availableTimes : [];
            const getCalendarDefaultTimes = (calendarId) => {
                if (calendarId === 'workspace') return businessDefaultTimes;
                const staffCalendar = settings.staffCalendars?.[calendarId] || {};
                return Array.isArray(staffCalendar.availableTimes) ? staffCalendar.availableTimes : businessDefaultTimes;
            };
            const getCalendarDayConfig = (calendarId, dateStr) => {
                const schedule = calendarId === 'workspace'
                    ? (settings.schedule || {})
                    : (settings.staffCalendars?.[calendarId]?.schedule || {});
                const savedConfig = schedule?.[dateStr];
                return {
                    available: savedConfig?.available ?? true,
                    times: Array.isArray(savedConfig?.times) ? savedConfig.times : [...getCalendarDefaultTimes(calendarId)]
                };
            };
            const defaultTimes = isAggregateCalendar
                ? [...new Set(staffMembersForCoverage.flatMap(staff => getCalendarDefaultTimes(staff.id)))].sort()
                : getCalendarDefaultTimes(selectedCalendarId);
            const todayStr = getLocalDateStr(new Date());
            const monthLookup = {
                jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
                may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7,
                sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11
            };
            const dateFromKey = (dateStr) => new Date(`${dateStr}T00:00:00`);
            const addDaysToDate = (date, days) => {
                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() + days);
                return nextDate;
            };
            const getDateRange = (startDate, endDate) => {
                const dates = [];
                const cursor = new Date(startDate);
                while (cursor <= endDate) {
                    dates.push(getLocalDateStr(cursor));
                    cursor.setDate(cursor.getDate() + 1);
                }
                return dates;
            };
            const formatCompactDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            const daysInMonth = useMemo(() => {
                const year = currentMonth.getFullYear();
                const month = currentMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const days = [];
                for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
                for (let i = 1; i <= daysInMonth; i++) days.push(getLocalDateStr(new Date(year, month, i)));
                return days;
            }, [currentMonth]);

            const getDayConfig = (dateStr) => {
                if (isAggregateCalendar) {
                    const businessConfig = getCalendarDayConfig('workspace', dateStr);
                    if (!businessConfig.available) return { available: false, times: [] };
                    if (!staffMembersForCoverage.length) return businessConfig;
                    const businessTimes = new Set(businessConfig.times || []);
                    const coveredTimes = staffMembersForCoverage
                        .flatMap(staff => {
                            const staffConfig = getCalendarDayConfig(staff.id, dateStr);
                            if (!staffConfig.available) return [];
                            return (staffConfig.times || []).filter(time => !businessTimes.size || businessTimes.has(time));
                        });
                    const uniqueTimes = [...new Set(coveredTimes)].sort();
                    return {
                        available: uniqueTimes.length > 0,
                        times: uniqueTimes
                    };
                }

                return getCalendarDayConfig(selectedCalendarId, dateStr);
            };

            const getBookingDateKey = (booking) => {
                if (booking.dateKey) return booking.dateKey;
                const rawDate = String(booking.date || '').trim();
                if (!rawDate) return null;
                if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) return rawDate;
                if (/^today$/i.test(rawDate)) return todayStr;
                if (/^tomorrow$/i.test(rawDate)) {
                    const tomorrow = new Date();
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    return getLocalDateStr(tomorrow);
                }

                const dayMonthMatch = rawDate.match(/(?:mon|tue|wed|thu|fri|sat|sun)?[a-z]*,?\s*(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
                if (dayMonthMatch) {
                    const day = Number(dayMonthMatch[1]);
                    const month = monthLookup[dayMonthMatch[2].toLowerCase()];
                    const year = Number(dayMonthMatch[3]) || currentMonth.getFullYear();
                    if (!Number.isNaN(day) && month !== undefined) return getLocalDateStr(new Date(year, month, day));
                }

                const parsed = new Date(rawDate);
                return Number.isNaN(parsed.getTime()) ? null : getLocalDateStr(parsed);
            };

            const bookingsByDate = useMemo(() => {
                return (bookings || []).reduce((summary, booking) => {
                    const dateKey = getBookingDateKey(booking);
                    if (!dateKey || booking.status === 'declined') return summary;
                    if (isSingleStaffCalendar && booking.staffId !== selectedCalendarId) return summary;
                    if (!summary[dateKey]) summary[dateKey] = { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
                    summary[dateKey].total += 1;
                    if (booking.status === 'confirmed') summary[dateKey].confirmed += 1;
                    if (booking.status === 'pending') summary[dateKey].pending += 1;
                    if (booking.status === 'waitlist' || booking.time === 'Waitlist') summary[dateKey].waitlist += 1;
                    if (booking.status !== 'waitlist' && booking.time !== 'Waitlist') summary[dateKey].reserved += 1;
                    return summary;
                }, {});
            }, [bookings, todayStr, currentMonth, selectedCalendarId, isSingleStaffCalendar]);

            const getCalendarBubble = (dateStr, config) => {
                const dayBookings = bookingsByDate[dateStr] || { confirmed: 0, reserved: 0 };
                const isPastDay = dateStr < todayStr;
                const openSlots = Math.max(0, (config.times?.length || 0) - dayBookings.reserved);

                if (isPastDay || dayBookings.confirmed > 0) {
                    return {
                        label: `${dayBookings.confirmed} ${dayBookings.confirmed === 1 ? 'booking' : 'bookings'} confirmed`,
                        count: dayBookings.confirmed,
                        caption: 'confirmed',
                        tone: dayBookings.confirmed > 0 ? 'confirmed' : 'quiet'
                    };
                }

                if (!config.available) return { label: 'Closed', count: null, caption: 'Closed', tone: 'closed' };

                return {
                    label: `${openSlots} ${openSlots === 1 ? 'slot' : 'slots'} open`,
                    count: openSlots,
                    caption: openSlots > 0 ? 'open' : 'full',
                    tone: openSlots > 0 ? 'open' : 'full'
                };
            };

            const guardCalendarEdit = () => {
                if (isAggregateCalendar) {
                    showToast("Choose Business Overview or a staff member to edit availability.");
                    return false;
                }
                if (!canEditSelectedCalendar) {
                    showToast(readOnlyCalendarMessage);
                    return false;
                }
                return true;
            };

            const getStaffCoverageForDate = (dateStr) => {
                if (!dateStr || !staffMembersForCoverage.length) return [];
                const businessConfig = getCalendarDayConfig('workspace', dateStr);
                if (!businessConfig.available) return [];
                const businessTimes = new Set(businessConfig.times || []);
                return staffMembersForCoverage.filter(staff => {
                    const staffConfig = getCalendarDayConfig(staff.id, dateStr);
                    if (!staffConfig.available) return false;
                    return (staffConfig.times || []).some(time => !businessTimes.size || businessTimes.has(time));
                });
            };

            const updateDateConfig = (dateStr, nextConfig) => {
                if (!guardCalendarEdit()) return;
                setSettings(prev => {
                    if (isWorkspaceCalendar) {
                        return {
                            ...prev,
                            schedule: {
                                ...(prev.schedule || {}),
                                [dateStr]: nextConfig
                            }
                        };
                    }
                    const previousCalendar = prev.staffCalendars?.[selectedCalendarId] || {};
                    return {
                        ...prev,
                        staffCalendars: {
                            ...(prev.staffCalendars || {}),
                            [selectedCalendarId]: {
                                ...previousCalendar,
                                staffId: selectedCalendarId,
                                schedule: {
                                    ...(previousCalendar.schedule || {}),
                                    [dateStr]: nextConfig
                                },
                                updatedAt: Date.now()
                            }
                        }
                    };
                });
            };

            const toggleDateAvailability = (dateStr) => {
                const config = getDayConfig(dateStr);
                updateDateConfig(dateStr, {
                    ...config,
                    available: !config.available
                });
            };

            const saveDefaultTime = () => {
                if (!guardCalendarEdit()) return;
                const time = defaultSlotTime?.trim();
                if (!time) return;
                if (defaultTimes.includes(time)) {
                    showToast("That slot already exists.");
                    return;
                }
                setSettings(prev => {
                    if (isWorkspaceCalendar) {
                        return { ...prev, availableTimes: [...(prev.availableTimes || []), time].sort() };
                    }
                    const previousCalendar = prev.staffCalendars?.[selectedCalendarId] || {};
                    return {
                        ...prev,
                        staffCalendars: {
                            ...(prev.staffCalendars || {}),
                            [selectedCalendarId]: {
                                ...previousCalendar,
                                staffId: selectedCalendarId,
                                availableTimes: [...(Array.isArray(previousCalendar.availableTimes) ? previousCalendar.availableTimes : defaultTimes), time].sort(),
                                updatedAt: Date.now()
                            }
                        }
                    };
                });
                setIsAddingDefaultSlot(false);
            };

            const getNextOpenTime = (existingTimes = []) => {
                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const nextHalfHour = Math.ceil((currentMinutes + 1) / 30) * 30;
                for (let i = 0; i < 48; i++) {
                    const minutes = (nextHalfHour + i * 30) % (24 * 60);
                    const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
                    const minute = String(minutes % 60).padStart(2, '0');
                    const candidate = `${hour}:${minute}`;
                    if (!existingTimes.includes(candidate)) return candidate;
                }
                return '18:00';
            };

            const startAddingSlot = () => {
                if (!guardCalendarEdit()) return;
                setNewSlotTime(getNextOpenTime(selectedConfig?.times || []));
                setIsAddingSlot(true);
            };

            const startAddingDefaultSlot = () => {
                if (!guardCalendarEdit()) return;
                setDefaultSlotTime(getNextOpenTime(defaultTimes));
                setIsAddingDefaultSlot(true);
            };

            const saveNewSlot = () => {
                if (!guardCalendarEdit()) return;
                if (!selectedConfig || !expandedDate) return;
                const time = newSlotTime?.trim();
                if (!time) return;
                if (selectedConfig.times.includes(time)) {
                    showToast("That time already exists for this day.");
                    return;
                }
                updateDateConfig(expandedDate, { ...selectedConfig, times: [...selectedConfig.times, time].sort() });
                setIsAddingSlot(false);
            };

            const selectedConfig = expandedDate ? getDayConfig(expandedDate) : null;
            const selectedDateLabel = expandedDate
                ? new Date(`${expandedDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
                : 'Select a date';
            const selectedDayBookings = expandedDate ? (bookingsByDate[expandedDate] || { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 }) : { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
            const selectedCapacity = selectedConfig?.available ? selectedConfig.times.length : 0;
            const selectedOpenSlots = expandedDate && expandedDate >= todayStr && selectedConfig?.available ? Math.max(0, selectedCapacity - selectedDayBookings.reserved) : 0;
            const selectedBookingRate = selectedCapacity ? Math.min(100, Math.round((selectedDayBookings.reserved / selectedCapacity) * 100)) : 0;
            const selectedAgendaDate = calendarViewMode === 'day' && hidePastDays && expandedDate < todayStr ? todayStr : expandedDate;
            const selectedDayBookingList = useMemo(() => {
                const toMinutes = (time = '') => {
                    const match = String(time).match(/^(\d{1,2}):(\d{2})/);
                    if (!match) return 9999;
                    return (Number(match[1]) * 60) + Number(match[2]);
                };

                return (bookings || [])
                    .map(booking => ({ ...booking, dateKeyResolved: getBookingDateKey(booking) }))
                    .filter(booking => (
                        booking.dateKeyResolved === selectedAgendaDate &&
                        booking.status !== 'declined' &&
                        (!isSingleStaffCalendar || booking.staffId === selectedCalendarId)
                    ))
                    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time) || String(a.clientName || '').localeCompare(String(b.clientName || '')));
            }, [bookings, selectedAgendaDate, selectedCalendarId, isSingleStaffCalendar, todayStr, currentMonth]);
            const selectedDayBookingsByTime = useMemo(() => {
                return selectedDayBookingList.reduce((groups, booking) => {
                    const timeKey = booking.time || 'Unscheduled';
                    groups[timeKey] = [...(groups[timeKey] || []), booking];
                    return groups;
                }, {});
            }, [selectedDayBookingList]);
            const getBookingStatusMeta = (booking) => {
                if (booking?.status === 'confirmed') return { label: 'Confirmed', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
                if (booking?.status === 'waitlist' || booking?.time === 'Waitlist') return { label: 'Waitlist', className: 'bg-violet-50 text-violet-700 border-violet-100' };
                if (booking?.status === 'pending') return { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-100' };
                return { label: booking?.status || 'Request', className: 'bg-neutral-100 text-neutral-600 border-neutral-200' };
            };
            const calendarAnchorDate = expandedDate ? dateFromKey(expandedDate) : new Date();
            const calendarWeekStart = addDaysToDate(calendarAnchorDate, -((calendarAnchorDate.getDay() + 6) % 7));
            const calendarWeekEnd = addDaysToDate(calendarWeekStart, 6);
            const calendarWindowLabel = calendarViewMode === 'month'
                ? currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : calendarViewMode === 'week'
                    ? `${formatCompactDate(calendarWeekStart)} - ${formatCompactDate(calendarWeekEnd)}`
                    : selectedDateLabel;
            const calendarTitle = calendarViewMode === 'month' ? 'Monthly Calendar' : calendarViewMode === 'week' ? 'Week Schedule' : 'Day Schedule';
            const calendarDescription = calendarViewMode === 'month'
                ? 'Open, close, and tune each day from one calm workspace.'
                : calendarViewMode === 'week'
                    ? 'Manage the current week without carrying the whole month around.'
                    : 'Focus on one day, its slots, and its booking capacity.';
            const calendarHeaderLabels = calendarViewMode === 'day'
                ? [calendarAnchorDate.toLocaleDateString('en-US', { weekday: 'short' })]
                : calendarViewMode === 'week'
                    ? getDateRange(calendarWeekStart, calendarWeekEnd)
                        .filter(dateStr => !hidePastDays || dateStr >= todayStr)
                        .map(dateStr => dateFromKey(dateStr).toLocaleDateString('en-US', { weekday: 'short' }))
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const calendarDisplayDays = useMemo(() => {
                if (calendarViewMode === 'day') {
                    const dayKey = hidePastDays && expandedDate < todayStr ? todayStr : expandedDate;
                    return [dayKey || todayStr];
                }

                if (calendarViewMode === 'week') {
                    const visibleWeek = getDateRange(calendarWeekStart, calendarWeekEnd).filter(dateStr => !hidePastDays || dateStr >= todayStr);
                    return visibleWeek.length ? visibleWeek : [todayStr];
                }

                if (hidePastDays) {
                    const visibleMonthDays = daysInMonth.filter(dateStr => dateStr && dateStr >= todayStr);
                    return visibleMonthDays.length ? visibleMonthDays : [todayStr];
                }

                return daysInMonth.map(dateStr => {
                    if (!dateStr) return null;
                    return dateStr;
                });
            }, [calendarViewMode, expandedDate, hidePastDays, todayStr, daysInMonth, calendarWeekStart, calendarWeekEnd]);
            const visibleCalendarDayCount = calendarDisplayDays.filter(Boolean).length;
            const isForwardMonthBoard = calendarViewMode === 'month' && hidePastDays;
            const calendarGridClass = calendarViewMode === 'day'
                ? 'grid-cols-1'
                : calendarViewMode === 'week'
                    ? 'grid-cols-2 sm:grid-cols-7'
                    : isForwardMonthBoard
                        ? visibleCalendarDayCount <= 5
                            ? 'grid-cols-[repeat(auto-fit,minmax(120px,1fr))]'
                            : visibleCalendarDayCount <= 10
                                ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5'
                                : visibleCalendarDayCount <= 14
                                    ? 'grid-cols-2 sm:grid-cols-4 xl:grid-cols-7'
                                    : 'grid-cols-2 sm:grid-cols-5 xl:grid-cols-7'
                        : 'grid-cols-7';
            const calendarHeaderClass = calendarViewMode === 'day' ? 'grid-cols-1' : calendarViewMode === 'week' ? 'grid-cols-2 sm:grid-cols-7' : 'grid-cols-7';
            const calendarHeaderVisibilityClass = calendarViewMode === 'month'
                ? (isForwardMonthBoard ? 'hidden' : 'grid')
                : 'hidden sm:grid';
            const calendarFrameClass = calendarViewMode === 'month' && !isForwardMonthBoard ? 'min-w-0 md:min-w-[560px] xl:min-w-0' : 'min-w-0';
            const calendarCellSizeClass = calendarViewMode === 'day'
                ? 'min-h-[420px] md:min-h-[460px]'
                : calendarViewMode === 'week'
                    ? 'min-h-[116px] md:min-h-[128px]'
                    : isForwardMonthBoard
                        ? 'min-h-[132px] md:min-h-[148px]'
                        : 'min-h-[92px] md:min-h-[120px]';

            const setCalendarScope = (mode) => {
                setCalendarViewMode(mode);
                if (mode === 'month' && isMobilePortraitCalendar) {
                    setHidePastDays(true);
                }
                if (mode !== 'month') {
                    const today = new Date();
                    setExpandedDate(todayStr);
                    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                }
            };

            const toggleHidePastDays = () => {
                const nextValue = !hidePastDays;
                setHidePastDays(nextValue);
                if (nextValue && expandedDate < todayStr) {
                    const today = new Date();
                    setExpandedDate(todayStr);
                    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                }
            };

            const moveCalendarWindow = (direction) => {
                if (calendarViewMode === 'month') {
                    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
                    if (hidePastDays && new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0) < dateFromKey(todayStr)) return;
                    setCurrentMonth(nextMonth);
                    return;
                }

                const nextDate = addDaysToDate(calendarAnchorDate, direction * (calendarViewMode === 'week' ? 7 : 1));
                const nextDateKey = getLocalDateStr(nextDate);
                if (hidePastDays && nextDateKey < todayStr) return;
                setExpandedDate(nextDateKey);
                setCurrentMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
            };

            const scheduleInsight = useMemo(() => {
                const anchorDate = expandedDate ? dateFromKey(expandedDate) : new Date();
                const weekStart = addDaysToDate(anchorDate, -((anchorDate.getDay() + 6) % 7));
                const weekEnd = addDaysToDate(weekStart, 6);
                const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
                const periodDates = scheduleStatsPeriod === 'day'
                    ? [getLocalDateStr(anchorDate)]
                    : scheduleStatsPeriod === 'week'
                        ? getDateRange(weekStart, weekEnd)
                        : getDateRange(monthStart, monthEnd);
                const label = scheduleStatsPeriod === 'day'
                    ? selectedDateLabel
                    : scheduleStatsPeriod === 'week'
                        ? `${formatCompactDate(weekStart)} - ${formatCompactDate(weekEnd)}`
                        : currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

                const summary = periodDates.reduce((acc, dateStr) => {
                    const config = getDayConfig(dateStr);
                    const savedConfig = activeSchedule?.[dateStr];
                    const dayBookings = bookingsByDate[dateStr] || { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
                    const capacity = config.available ? (config.times?.length || 0) : 0;
                    const openSlots = dateStr >= todayStr && config.available ? Math.max(0, capacity - dayBookings.reserved) : 0;

                    acc.totalDays += 1;
                    acc.confirmed += dayBookings.confirmed;
                    acc.pending += dayBookings.pending;
                    acc.waitlist += dayBookings.waitlist;
                    acc.reserved += dayBookings.reserved;
                    acc.capacity += capacity;
                    acc.openSlots += openSlots;
                    if (config.available) acc.openDays += 1;
                    else acc.closedDays += 1;
                    if (savedConfig) acc.customDays += 1;
                    return acc;
                }, { totalDays: 0, openDays: 0, closedDays: 0, customDays: 0, capacity: 0, openSlots: 0, confirmed: 0, pending: 0, waitlist: 0, reserved: 0 });

                const fillRate = summary.capacity ? Math.min(100, Math.round((summary.reserved / summary.capacity) * 100)) : 0;
                const dayStatus = !selectedConfig ? 'Select a date' : expandedDate < todayStr ? 'Past Day' : selectedConfig.available ? 'Open' : 'Closed';

                return {
                    ...summary,
                    label,
                    fillRate,
                    dayStatus,
                    periodName: scheduleStatsPeriod.charAt(0).toUpperCase() + scheduleStatsPeriod.slice(1)
                };
            }, [scheduleStatsPeriod, expandedDate, selectedDateLabel, selectedConfig, currentMonth, activeSchedule, defaultTimes, bookingsByDate, todayStr]);

            const scheduleMetricCards = useMemo(() => {
                if (scheduleStatsPeriod === 'day') {
                    return [
                        { label: 'Day Status', value: scheduleInsight.dayStatus, hint: scheduleInsight.label, icon: scheduleInsight.dayStatus === 'Closed' ? XCircle : CheckCircle2, tone: scheduleInsight.dayStatus === 'Open' ? 'accent' : 'neutral' },
                        { label: 'Confirmed', value: scheduleInsight.confirmed, hint: `${scheduleInsight.pending} pending`, icon: CalendarCheck, tone: 'light' },
                        { label: 'Open Slots', value: scheduleInsight.openSlots, hint: `${scheduleInsight.capacity} capacity`, icon: Clock, tone: 'light' },
                        { label: 'Booking Rate', value: `${scheduleInsight.fillRate}%`, hint: `${scheduleInsight.reserved} reserved`, icon: ShieldCheck, tone: 'dark' }
                    ];
                }

                if (scheduleStatsPeriod === 'week') {
                    return [
                        { label: 'Confirmed', value: scheduleInsight.confirmed, hint: 'This week', icon: CalendarCheck, tone: 'accent' },
                        { label: 'Open Slots', value: scheduleInsight.openSlots, hint: 'Capacity left', icon: Clock, tone: 'light' },
                        { label: 'Open Days', value: `${scheduleInsight.openDays}/${scheduleInsight.totalDays}`, hint: `${scheduleInsight.closedDays} closed`, icon: CheckCircle2, tone: 'light' },
                        { label: 'Booking Rate', value: `${scheduleInsight.fillRate}%`, hint: `${scheduleInsight.waitlist} waitlist`, icon: ShieldCheck, tone: 'dark' }
                    ];
                }

                return [
                    { label: 'Confirmed', value: scheduleInsight.confirmed, hint: 'This month', icon: CalendarCheck, tone: 'accent' },
                    { label: 'Open Slots', value: scheduleInsight.openSlots, hint: 'Today forward', icon: Clock, tone: 'light' },
                    { label: 'Open Days', value: `${scheduleInsight.openDays}/${scheduleInsight.totalDays}`, hint: `${scheduleInsight.closedDays} closed`, icon: CheckCircle2, tone: 'light' },
                    { label: 'Booking Rate', value: `${scheduleInsight.fillRate}%`, hint: `${scheduleInsight.waitlist} waitlist`, icon: ShieldCheck, tone: 'dark' }
                ];
            }, [scheduleStatsPeriod, scheduleInsight]);

            useEffect(() => {
                setIsAddingSlot(false);
            }, [expandedDate]);

            useEffect(() => {
                if (typeof window === 'undefined' || !window.matchMedia) return undefined;
                const portraitQuery = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
                const updatePortraitState = () => setIsMobilePortraitCalendar(portraitQuery.matches);
                updatePortraitState();
                if (portraitQuery.addEventListener) {
                    portraitQuery.addEventListener('change', updatePortraitState);
                    return () => portraitQuery.removeEventListener('change', updatePortraitState);
                }
                portraitQuery.addListener?.(updatePortraitState);
                return () => portraitQuery.removeListener?.(updatePortraitState);
            }, []);

            useEffect(() => {
                if (calendarViewMode === 'month' && isMobilePortraitCalendar) {
                    setHidePastDays(true);
                }
            }, [calendarViewMode, isMobilePortraitCalendar]);

            const googleSyncableBookings = useMemo(() => (
                (bookings || []).filter(booking => (
                    !booking.isExample &&
                    booking.status === 'confirmed' &&
                    booking.dateKey &&
                    booking.time &&
                    booking.time !== 'Waitlist' &&
                    !booking.googleCalendarEventId &&
                    (!isSingleStaffCalendar || booking.staffId === selectedCalendarId)
                ))
            ), [bookings, isSingleStaffCalendar, selectedCalendarId]);
            const googleCalendarConnected = Boolean(googleCalendarState.connected);
            const googleCalendarLabel = googleCalendarConnected
                ? 'Google Connected'
                : googleCalendarState.email
                    ? 'Reconnect Google'
                    : 'Connect Google';

            return (
                <div className="w-full max-w-7xl mx-auto pb-32 animate-in fade-in duration-700">
                    <div className="mb-4 md:mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto] gap-2 sm:gap-3">
                        <div className="rounded-lg border border-neutral-100 bg-white px-4 py-3 shadow-sm flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-neutral-400">Google Calendar</p>
                                <p className="text-sm font-bold text-black truncate">
                                    {googleCalendarConnected ? `Connected${googleCalendarState.email ? ` as ${googleCalendarState.email}` : ''}` : 'Connect once, then sync confirmed bookings.'}
                                </p>
                            </div>
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${googleCalendarConnected ? 'bg-[#39FF14] shadow-[0_0_0_5px_rgba(57,255,20,0.15)]' : 'bg-neutral-200'}`} />
                        </div>
                        <button onClick={() => onConnectGoogleCalendar?.()} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-white border border-neutral-200 text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors shadow-sm text-black flex items-center justify-center gap-2">
                            <CalendarCheck size={15} /> {googleCalendarLabel}
                        </button>
                        <button onClick={() => onSyncGoogleCalendar?.(selectedCalendarId)} disabled={googleCalendarState.syncing} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-white border border-neutral-200 text-[10px] md:text-[11px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors shadow-sm text-black flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait">
                            <RefreshCw size={15} className={googleCalendarState.syncing ? 'animate-spin' : ''} /> {googleCalendarState.syncing ? 'Syncing' : `Sync ${googleSyncableBookings.length}`}
                        </button>
                        <button onClick={onSave} className="h-10 md:h-11 px-4 md:px-5 rounded-lg bg-black text-white text-[10px] md:text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-800 transition-colors shadow-xl shadow-black/10">
                            <Check size={15}/> Save Schedule
                        </button>
                    </div>

                    <section className="saas-card p-3 md:p-4 mb-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">Team Calendar</p>
                                <h3 className="text-lg md:text-xl font-bold tracking-tight text-black truncate">
                                    {isWorkspaceCalendar ? 'Business Overview' : selectedCalendar?.name || 'My Calendar'}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {isWorkspaceCalendar
                                        ? `${staffMembersForCoverage.length} staff ${staffMembersForCoverage.length === 1 ? 'calendar' : 'calendars'} in view`
                                        : canEditSelectedCalendar ? 'Editing this calendar' : 'View only calendar'}
                                </p>
                            </div>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 lg:justify-end">
                                {visibleCalendarOptions.map(calendar => {
                                    const active = selectedCalendarId === calendar.id;
                                    const initials = getStaffInitials(calendar.name);
                                    return (
                                        <button
                                            key={calendar.id}
                                            type="button"
                                            onClick={() => setSelectedCalendarId(calendar.id)}
                                            className={`min-w-[156px] h-12 rounded-lg border px-3 flex items-center gap-3 text-left transition-all ${active ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-white text-black border-neutral-200 hover:border-black'}`}
                                        >
                                            <span className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold overflow-hidden ${active ? 'native-gradient-icon text-black' : 'bg-neutral-50 border border-neutral-100 text-black'}`}>
                                                {calendar.photoURL ? <img src={calendar.photoURL} alt="" className="w-full h-full object-cover" /> : calendar.id === 'workspace' ? <Users size={14} /> : initials}
                                            </span>
                                            <span className="min-w-0">
                                                <span className={`block text-sm font-bold truncate ${active ? 'text-white' : 'text-black'}`}>{calendar.name}</span>
                                                <span className={`block text-[8px] font-bold uppercase tracking-[0.16em] truncate ${active ? 'text-white/45' : 'text-neutral-400'}`}>{calendar.username || calendar.role}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {!canEditSelectedCalendar && (
                            <div className="mt-3 rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-500">
                                {readOnlyCalendarMessage}
                            </div>
                        )}
                    </section>

                    <section className="saas-card overflow-hidden mb-6">
                        <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-neutral-400 mb-2">Schedule Pulse</p>
                                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-black">{scheduleInsight.periodName} Stats</h3>
                                <p className="text-sm text-neutral-500 mt-1">{scheduleInsight.label}</p>
                            </div>
                            <div className="flex bg-neutral-100 p-1.5 rounded-lg border border-neutral-200 w-full sm:w-fit">
                                {['day', 'week', 'month'].map(period => (
                                    <button
                                        key={period}
                                        onClick={() => setScheduleStatsPeriod(period)}
                                        className={`flex-1 sm:flex-none h-10 px-5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${scheduleStatsPeriod === period ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                                    >
                                        {period}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="native-stat-grid grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-4">
                            {scheduleMetricCards.map((item, index) => {
                                const IconCmp = item.icon;
                                return (
                                    <div key={item.label} className={`native-stat-card p-5 md:p-6 border-neutral-100 bg-white text-black ${index > 0 ? 'xl:border-l' : ''} ${index % 2 === 1 ? 'sm:border-l xl:border-l' : ''} ${index > 1 ? 'sm:border-t xl:border-t-0' : ''}`}>
                                        <div className="flex items-start justify-between gap-4 mb-8">
                                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-neutral-100 text-black">
                                                <IconCmp size={17}/>
                                            </div>
                                            <span className="max-w-[170px] text-right leading-tight text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md bg-neutral-100 text-neutral-500">{item.hint}</span>
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] mb-2 text-neutral-400">{item.label}</p>
                                        <p className="metric-value text-3xl md:text-4xl font-bold tracking-tight leading-none">{item.value}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    <div className="grid grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start min-[1400px]:items-stretch">
                        <section data-tour="schedule-calendar" className={`saas-card schedule-calendar-card schedule-mode-${calendarViewMode} ${hidePastDays ? 'schedule-forward-days' : ''} ${calendarViewMode === 'day' ? 'min-[1400px]:col-span-2' : ''} overflow-hidden`}>
                            <div className="p-5 md:p-6 border-b border-neutral-100 flex flex-col md:flex-row md:items-center justify-between gap-5 bg-white">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-neutral-400 mb-2">Calendar Board</p>
                                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-black">{calendarTitle}</h3>
                                    <p className="text-sm text-neutral-500 mt-1">{calendarDescription}</p>
                                </div>
                                <div className="flex flex-col gap-3 w-full md:w-auto md:items-end">
                                    <div className="schedule-month-switcher flex items-center gap-2 bg-neutral-50 p-1.5 rounded-lg border border-neutral-100 w-full md:w-fit shadow-sm">
                                        <button onClick={() => moveCalendarWindow(-1)} className="w-10 h-10 rounded-md bg-white border border-neutral-100 text-neutral-500 hover:text-black hover:border-neutral-200 transition-colors flex items-center justify-center shrink-0"><ChevronLeft size={18}/></button>
                                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] min-w-0 md:min-w-[158px] flex-1 text-center text-black">{calendarWindowLabel}</span>
                                        <button onClick={() => moveCalendarWindow(1)} className="w-10 h-10 rounded-md bg-white border border-neutral-100 text-neutral-500 hover:text-black hover:border-neutral-200 transition-colors flex items-center justify-center shrink-0"><ChevronRight size={18}/></button>
                                    </div>
                                    <div className="schedule-calendar-toolbar flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                                        <div className="schedule-scope-toggle flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 w-full sm:w-fit">
                                            {['month', 'week', 'day'].map(mode => (
                                                <button
                                                    key={mode}
                                                    type="button"
                                                    aria-pressed={calendarViewMode === mode}
                                                    onClick={() => setCalendarScope(mode)}
                                                    className={`h-9 px-4 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all flex-1 sm:flex-none ${calendarViewMode === mode ? 'bg-black text-white shadow-lg' : 'text-neutral-500 hover:text-black hover:bg-white'}`}
                                                >
                                                    {mode}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            aria-pressed={hidePastDays}
                                            onClick={toggleHidePastDays}
                                            className={`schedule-hide-toggle h-11 sm:h-auto px-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${hidePastDays ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-neutral-500 border-neutral-200 hover:text-black'}`}
                                        >
                                            <span className={`w-5 h-5 rounded-full border flex items-center justify-center ${hidePastDays ? 'bg-[#39FF14] border-transparent text-black' : 'bg-neutral-50 border-neutral-200'}`}>
                                                {hidePastDays && <Check size={11}/>}
                                            </span>
                                            Hide past
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 md:p-6 overflow-x-auto no-scrollbar bg-gradient-to-b from-white to-neutral-50/60">
                                <div className={calendarFrameClass}>
                                {calendarViewMode === 'month' && (
                                    <div className="schedule-rotate-prompt mb-3 rounded-lg border border-neutral-100 bg-white/85 px-3 py-3 text-black">
                                        <div className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
                                            <RefreshCw size={14} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-neutral-400">Rotate for full month</p>
                                            <p className="text-xs font-semibold text-neutral-600 leading-snug">Portrait keeps this as a clean forward list. Turn sideways for the classic calendar grid.</p>
                                        </div>
                                    </div>
                                )}
                                <div className={`calendar-week-heading ${calendarHeaderVisibilityClass} ${calendarHeaderClass} gap-2 md:gap-3 mb-3 rounded-lg bg-white/75 border border-neutral-100 px-2 py-3`}>
                                    {calendarHeaderLabels.map((d) => (
                                        <div key={d} className="text-center text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-neutral-300">{d}</div>
                                    ))}
                                </div>

                                <div className={`schedule-calendar-grid grid ${calendarGridClass} gap-2 md:gap-3`}>
                                    {calendarDisplayDays.map((dateStr, i) => {
                                        if (!dateStr) return <div key={`empty-${i}`} className={`${calendarCellSizeClass} rounded-lg bg-white/35 border border-neutral-100/70`} />;
                                        const dayNum = Number(dateStr.split('-')[2]);
                                        const config = getDayConfig(dateStr);
                                        const isSelected = expandedDate === dateStr;
                                        const isToday = todayStr === dateStr;
                                        const isPastDay = dateStr < todayStr;
                                        const isCustom = Boolean(activeSchedule?.[dateStr]);
                                        const calendarBubble = getCalendarBubble(dateStr, config);
                                        const staffCoverage = isWorkspaceCalendar ? getStaffCoverageForDate(dateStr) : [];
                                        const bubbleClass = {
                                            open: isSelected ? 'bg-[#39FF14] text-black border-transparent' : 'bg-white text-black border-neutral-200',
                                            confirmed: isSelected ? 'bg-[#39FF14] text-black border-transparent' : 'bg-emerald-50 text-emerald-700 border-emerald-100',
                                            quiet: 'bg-white text-neutral-400 border-neutral-200',
                                            closed: 'bg-red-50 text-red-600 border-red-100',
                                            full: 'bg-amber-50 text-amber-700 border-amber-100'
                                        }[calendarBubble.tone];

                                        if (calendarViewMode === 'day') {
                                            const daySummary = bookingsByDate[dateStr] || { confirmed: 0, reserved: 0, pending: 0, waitlist: 0, total: 0 };
                                            const dayCapacity = config.available ? config.times.length : 0;
                                            const dayOpenSlots = dateStr >= todayStr && config.available ? Math.max(0, dayCapacity - daySummary.reserved) : 0;
                                            const dayRate = dayCapacity ? Math.min(100, Math.round((daySummary.reserved / dayCapacity) * 100)) : 0;
                                            const unslottedBookings = selectedDayBookingList.filter(booking => !config.times.includes(booking.time));

                                            return (
                                                <div
                                                    key={dateStr}
                                                    className={`schedule-day-agenda-card relative ${calendarCellSizeClass} rounded-lg border p-4 md:p-5 overflow-hidden ${isSelected ? 'schedule-day-selected bg-white text-black border-transparent' : 'bg-white border-neutral-200'}`}
                                                >
                                                    {!isPastDay && (
                                                        <button
                                                            type="button"
                                                            aria-label={config.available ? `Mark ${dateStr} unavailable` : `Mark ${dateStr} available`}
                                                            title={config.available ? 'Mark unavailable' : 'Mark available'}
                                                            onClick={() => toggleDateAvailability(dateStr)}
                                                            className={`absolute right-4 top-4 w-9 h-9 rounded-full border flex items-center justify-center transition-all duration-300 shadow-sm z-10 ${config.available ? 'bg-[#39FF14] border-transparent text-black' : 'bg-red-500 border-red-500 text-white'}`}
                                                        >
                                                            {config.available ? <Check size={14}/> : <X size={14}/>}
                                                        </button>
                                                    )}

                                                    <div className="grid grid-cols-1 xl:grid-cols-[0.82fr_1.18fr] gap-5 h-full">
                                                        <div className="flex flex-col min-h-0 pr-0 xl:pr-3">
                                                            <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-neutral-400 mb-2">
                                                                {new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                                            </p>
                                                            <div className="flex items-start justify-between gap-4 mb-5">
                                                                <div>
                                                                    <p className="metric-value text-5xl md:text-6xl font-black tracking-tight leading-none text-black">{dayNum}</p>
                                                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                                                        {isToday && <span className="rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest bg-black text-white">Today</span>}
                                                                        {isCustom && <span className="rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-500">Custom</span>}
                                                                        <span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${config.available ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{config.available ? 'Open' : 'Closed'}</span>
                                                                    </div>
                                                                    {staffCoverage.length > 0 && (
                                                                        <div className="mt-4 flex items-center gap-2">
                                                                            <div className="flex -space-x-2">
                                                                                {staffCoverage.slice(0, 4).map(staff => (
                                                                                    <span
                                                                                        key={staff.id}
                                                                                        className="w-7 h-7 rounded-full border-2 border-white bg-neutral-100 text-[9px] font-black text-black flex items-center justify-center overflow-hidden shadow-sm"
                                                                                        title={getStaffDisplayName(staff)}
                                                                                    >
                                                                                        {staff.photoURL ? <img src={staff.photoURL} alt="" className="w-full h-full object-cover" /> : getStaffInitials(getStaffDisplayName(staff))}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                            <span className="text-[10px] font-bold text-neutral-500">
                                                                                {staffCoverage.length} covering this day
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-3 gap-2 mb-5">
                                                                {[
                                                                    { label: 'Booked', value: daySummary.reserved },
                                                                    { label: 'Open', value: dayOpenSlots },
                                                                    { label: 'Rate', value: `${dayRate}%` }
                                                                ].map(item => (
                                                                    <div key={item.label} className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-3">
                                                                        <p className="metric-value text-xl md:text-2xl font-bold text-black leading-none">{item.value}</p>
                                                                        <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-neutral-400">{item.label}</p>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            <div className="rounded-lg border border-neutral-100 bg-neutral-50/70 p-3 mt-auto">
                                                                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-1">Day Flow</p>
                                                                <p className="text-sm text-neutral-600 leading-snug">
                                                                    {selectedDayBookingList.length
                                                                        ? `${selectedDayBookingList.length} booking ${selectedDayBookingList.length === 1 ? 'record' : 'records'} synced to this calendar.`
                                                                        : 'No bookings yet. Open slots are ready for clients.'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0">
                                                            <div className="rounded-lg border border-neutral-100 bg-white p-3 md:p-4 min-h-0">
                                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400">Slot Timeline</p>
                                                                        <p className="text-sm font-bold text-black">{config.times.length || 0} times available</p>
                                                                    </div>
                                                                    <Clock size={16} className="text-neutral-300" />
                                                                </div>
                                                                <div className="space-y-2 max-h-[310px] overflow-y-auto no-scrollbar pr-1">
                                                                    {config.times.length ? config.times.map(time => {
                                                                        const timeBookings = selectedDayBookingsByTime[time] || [];
                                                                        const hasBookings = timeBookings.length > 0;
                                                                        return (
                                                                            <div key={time} className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-3 py-3">
                                                                                <div className="flex items-center justify-between gap-3">
                                                                                    <div className="flex items-center gap-3 min-w-0">
                                                                                        <span className="w-8 h-8 rounded-md bg-white border border-neutral-100 flex items-center justify-center shrink-0">
                                                                                            <Clock size={13} className="text-neutral-400"/>
                                                                                        </span>
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-sm font-black tracking-widest text-black">{time}</p>
                                                                                            <p className="text-[10px] text-neutral-400 font-semibold truncate">{hasBookings ? timeBookings.map(booking => booking.clientName || 'Client').join(', ') : 'Available for booking'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${hasBookings ? 'bg-black text-white border-black' : 'bg-white text-neutral-500 border-neutral-200'}`}>
                                                                                        {hasBookings ? `${timeBookings.length} booked` : 'Open'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }) : (
                                                                        <div className="rounded-lg border border-dashed border-neutral-200 p-5 text-center text-sm font-medium text-neutral-400">No slots set for this day.</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="rounded-lg border border-neutral-100 bg-white p-3 md:p-4 min-h-0">
                                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                                    <div>
                                                                        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-neutral-400">Bookings</p>
                                                                        <p className="text-sm font-bold text-black">{selectedDayBookingList.length ? 'Synced records' : 'Clear day'}</p>
                                                                    </div>
                                                                    <CalendarCheck size={16} className="text-neutral-300" />
                                                                </div>
                                                                <div className="space-y-2 max-h-[310px] overflow-y-auto no-scrollbar pr-1">
                                                                    {selectedDayBookingList.length ? selectedDayBookingList.map(booking => {
                                                                        const statusMeta = getBookingStatusMeta(booking);
                                                                        const clientAvatar = getBookingClientAvatar(booking);
                                                                        return (
                                                                            <div key={booking.id || `${booking.clientName}-${booking.time}`} className="rounded-lg border border-neutral-100 bg-neutral-50/70 px-3 py-3">
                                                                                <div className="flex items-start justify-between gap-3">
                                                                                    <div className="flex items-start gap-3 min-w-0">
                                                                                        <div className="w-9 h-9 rounded-full bg-white border border-neutral-100 flex items-center justify-center overflow-hidden shrink-0 text-xs font-black text-black">
                                                                                            {clientAvatar ? <img src={clientAvatar} alt="" className="w-full h-full object-cover" /> : (booking.clientName || 'C').charAt(0).toUpperCase()}
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-sm font-black text-black truncate">{booking.clientName || 'Client'}</p>
                                                                                            <p className="text-xs text-neutral-500 mt-1 truncate">{booking.clientPhone || booking.clientEmail || booking.email || 'Client details saved'}</p>
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[8px] font-bold uppercase tracking-widest ${statusMeta.className}`}>{statusMeta.label}</span>
                                                                                </div>
                                                                                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                                                                                    <span>{booking.time || 'Unscheduled'}</span>
                                                                                    {booking.staffName && <span className="truncate">With {booking.staffName}</span>}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    }) : (
                                                                        <div className="rounded-lg border border-dashed border-neutral-200 p-5 text-center">
                                                                            <CalendarCheck size={20} className="mx-auto mb-2 text-neutral-300" />
                                                                            <p className="text-sm font-bold text-black">No appointments yet</p>
                                                                            <p className="text-xs text-neutral-400 mt-1">New requests for this day will appear here.</p>
                                                                        </div>
                                                                    )}

                                                                    {unslottedBookings.length > 0 && (
                                                                        <div className="rounded-lg border border-violet-100 bg-violet-50/70 px-3 py-3">
                                                                            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-violet-700 mb-1">Needs placement</p>
                                                                            <p className="text-xs text-violet-700">{unslottedBookings.length} booking {unslottedBookings.length === 1 ? 'record is' : 'records are'} not tied to a visible slot.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={dateStr}
                                                role="button"
                                                tabIndex="0"
                                                onClick={() => setExpandedDate(dateStr)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setExpandedDate(dateStr);
                                                    }
                                                }}
                                                className={`schedule-day-cell group relative ${calendarCellSizeClass} rounded-lg border transition-all duration-500 flex flex-col p-2.5 text-left overflow-hidden cursor-pointer ${isSelected ? 'schedule-day-selected bg-white text-black border-transparent scale-[1.012]' : config.available ? 'bg-white border-neutral-200 hover:-translate-y-0.5' : 'bg-neutral-50/90 border-neutral-100 text-neutral-300 grayscale'}`}
                                            >
                                                {!isPastDay && (
                                                    <button
                                                        type="button"
                                                        aria-label={config.available ? `Mark ${dateStr} unavailable` : `Mark ${dateStr} available`}
                                                        title={config.available ? 'Mark unavailable' : 'Mark available'}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleDateAvailability(dateStr);
                                                        }}
                                                        className={`absolute right-1.5 top-1.5 w-6 h-6 rounded-full border flex items-center justify-center transition-all duration-300 shadow-sm z-10 ${config.available ? (isSelected ? 'bg-[#39FF14] border-transparent text-black' : 'bg-white border-neutral-200 text-neutral-500 hover:bg-[#39FF14] hover:border-transparent hover:text-black') : (isSelected ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-red-100 text-red-500 hover:bg-red-500 hover:border-red-500 hover:text-white')}`}
                                                    >
                                                        {config.available ? <Check size={10}/> : <X size={10}/>}
                                                    </button>
                                                )}
                                                {(calendarViewMode !== 'month' || hidePastDays) && (
                                                    <p className="mb-2 pr-7 text-[8px] font-bold uppercase tracking-[0.24em] text-neutral-400">
                                                        {new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </p>
                                                )}
                                                <div className="flex items-start justify-between gap-1 mb-2 pr-6">
                                                    <span className={`metric-value text-xl md:text-[22px] font-bold tracking-tight leading-none ${!config.available ? 'line-through opacity-40' : ''}`}>{dayNum}</span>
                                                </div>
                                                {staffCoverage.length > 0 && (
                                                    <div className="mb-2 flex items-center gap-1.5">
                                                        <div className="flex -space-x-1.5">
                                                            {staffCoverage.slice(0, 3).map(staff => (
                                                                <span
                                                                    key={staff.id}
                                                                    className="w-5 h-5 rounded-full border border-white bg-neutral-100 text-[7px] font-black text-black flex items-center justify-center overflow-hidden shadow-sm"
                                                                    title={getStaffDisplayName(staff)}
                                                                >
                                                                    {staff.photoURL ? <img src={staff.photoURL} alt="" className="w-full h-full object-cover" /> : getStaffInitials(getStaffDisplayName(staff))}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        <span className="rounded-full bg-neutral-50 border border-neutral-100 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.12em] text-neutral-400">
                                                            {staffCoverage.length}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="mt-auto space-y-2">
                                                    <div className="min-h-[14px] flex flex-wrap items-center gap-1">
                                                        {isToday && <span className={`rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest ${isSelected ? 'bg-black text-white' : 'bg-black text-white'}`}>Today</span>}
                                                        {isCustom && <span className="rounded-full px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-widest bg-neutral-100 text-neutral-400">Custom</span>}
                                                    </div>
                                                    <span
                                                        className={`schedule-slot-pill inline-flex min-h-[28px] w-full items-center justify-center gap-1 rounded-full border px-2 py-1 text-center font-bold leading-none transition-colors ${bubbleClass}`}
                                                        aria-label={calendarBubble.label}
                                                        title={calendarBubble.label}
                                                    >
                                                        {calendarBubble.count !== null && <span className="metric-value text-[12px] leading-none font-black tracking-tight">{calendarBubble.count}</span>}
                                                        <span className="text-[6px] uppercase tracking-[0.12em] leading-tight">{calendarBubble.caption}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                </div>
                            </div>
                        </section>

                        <aside className="space-y-6">
                            <section className="saas-card schedule-side-panel p-5">
                                <div className="flex items-start justify-between gap-4 mb-5">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-400 mb-2">Template</p>
                                        <h3 className="text-xl font-bold tracking-tight text-black">Default Slots</h3>
                                        <p className="text-sm text-neutral-500 mt-1">{isAggregateCalendar ? 'Combined from every active staff calendar.' : isWorkspaceCalendar ? 'New open days start with these times.' : `${selectedCalendar?.name || 'This staff member'} uses these default times.`}</p>
                                    </div>
                                    <button onClick={startAddingDefaultSlot} disabled={!canEditSelectedCalendar} className={`w-11 h-11 rounded-lg flex items-center justify-center transition-transform shrink-0 shadow-lg shadow-black/5 ${!canEditSelectedCalendar ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : 'bg-[#39FF14] text-black hover:scale-105'}`}>
                                        <Plus size={16}/>
                                    </button>
                                </div>
                                {isAddingDefaultSlot && (
                                    <div className="mb-4 p-4 rounded-lg bg-white border border-neutral-200 shadow-[0_18px_50px_-34px_rgba(0,0,0,0.45)] animate-in fade-in zoom-in-95 duration-200">
                                        <label className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400 block mb-3">New Default Slot</label>
                                        <div className="h-12 rounded-lg bg-neutral-50 border border-neutral-100 px-4 flex items-center gap-3 focus-within:bg-white focus-within:border-black transition-colors mb-3">
                                            <Clock size={15} className="text-neutral-400"/>
                                            <input
                                                type="time"
                                                value={defaultSlotTime}
                                                onChange={(event) => setDefaultSlotTime(event.target.value)}
                                                className="w-full bg-transparent outline-none text-base font-bold tracking-tight text-black"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <button onClick={saveDefaultTime} className="h-10 rounded-lg bg-black text-white text-[10px] font-bold uppercase tracking-[0.12em] hover:bg-neutral-800 transition-colors">
                                                Save Slot
                                            </button>
                                            <button onClick={() => setIsAddingDefaultSlot(false)} className="h-10 rounded-lg bg-white border border-neutral-200 text-black text-[10px] font-bold uppercase tracking-[0.12em] hover:border-black transition-colors">
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-2">
                                    {defaultTimes.length ? defaultTimes.map((time, i) => (
                                        <div key={`${time}-${i}`} className="schedule-time-chip group flex items-center justify-between gap-2 bg-white border border-neutral-200 px-3 py-2.5 rounded-lg text-sm font-bold text-black shadow-sm">
                                            <span className="flex items-center gap-2">
                                                <Clock size={13} className="text-neutral-400"/>
                                                {time}
                                            </span>
                                            <button onClick={() => {
                                                if (!guardCalendarEdit()) return;
                                                setSettings(prev => {
                                                if (isWorkspaceCalendar) {
                                                    return { ...prev, availableTimes: (prev.availableTimes || []).filter((_, idx) => idx !== i) };
                                                }
                                                const previousCalendar = prev.staffCalendars?.[selectedCalendarId] || {};
                                                return {
                                                    ...prev,
                                                    staffCalendars: {
                                                        ...(prev.staffCalendars || {}),
                                                        [selectedCalendarId]: {
                                                            ...previousCalendar,
                                                            staffId: selectedCalendarId,
                                                            availableTimes: defaultTimes.filter((_, idx) => idx !== i),
                                                            updatedAt: Date.now()
                                                        }
                                                    }
                                                };
                                            });
                                            }} disabled={!canEditSelectedCalendar} className={`transition-colors ${canEditSelectedCalendar ? 'text-neutral-300 hover:text-red-500' : 'text-neutral-200 cursor-not-allowed'}`}><X size={13}/></button>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-neutral-400 bg-white border border-dashed border-neutral-200 rounded-lg p-4 col-span-2">No default slots yet.</p>
                                    )}
                                </div>
                            </section>

                            <section className="saas-card schedule-selected-panel p-5 md:p-6 overflow-hidden">
                                <div className="flex items-start justify-between gap-4 mb-6">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-neutral-400 mb-2">Selected Day</p>
                                        <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-black leading-none">{selectedDateLabel}</h3>
                                    </div>
                                    {selectedConfig && (
                                        <button
                                            onClick={() => updateDateConfig(expandedDate, { ...selectedConfig, available: !selectedConfig.available })}
                                            disabled={!canEditSelectedCalendar}
                                            className={`h-10 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${!canEditSelectedCalendar ? 'bg-neutral-100 text-neutral-300 cursor-not-allowed' : selectedConfig.available ? 'bg-[#39FF14] text-black shadow-lg shadow-black/5' : 'bg-red-50 text-red-600'}`}
                                        >
                                            {selectedConfig.available ? <CheckCircle2 size={14}/> : <XCircle size={14}/>}
                                            {selectedConfig.available ? 'Open' : 'Closed'}
                                        </button>
                                    )}
                                </div>

                                {!selectedConfig ? (
                                    <div className="py-14 text-center text-neutral-400 text-sm font-medium">Pick a date on the calendar.</div>
                                ) : selectedConfig.available ? (
                                    <>
                                        {!canEditSelectedCalendar && (
                                            <div className="mb-5 rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-500">
                                                {readOnlyCalendarMessage}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-3 gap-2 mb-5">
                                            {[
                                                { label: 'Booked', value: selectedDayBookings.confirmed },
                                                { label: 'Open', value: selectedOpenSlots },
                                                { label: 'Rate', value: `${selectedBookingRate}%` }
                                            ].map(item => (
                                                <div key={item.label} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-3">
                                                    <p className="metric-value text-lg font-bold text-black leading-none">{item.value}</p>
                                                    <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-neutral-400">{item.label}</p>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="space-y-2 mb-5 max-h-[292px] overflow-y-auto no-scrollbar pr-1">
                                            {selectedConfig.times.length ? selectedConfig.times.map(time => (
                                                <div key={time} className="schedule-selected-slot flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white border border-neutral-200">
                                                    <div className="flex items-center gap-3 text-sm font-bold tracking-widest text-black">
                                                        <span className="w-8 h-8 rounded-md bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                                                            <Clock size={14} className="text-neutral-400"/>
                                                        </span>
                                                        {time}
                                                    </div>
                                                    <button onClick={() => updateDateConfig(expandedDate, { ...selectedConfig, times: selectedConfig.times.filter(t => t !== time) })} disabled={!canEditSelectedCalendar} className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${canEditSelectedCalendar ? 'text-neutral-300 hover:text-red-500 hover:bg-white' : 'text-neutral-200 cursor-not-allowed'}`}>
                                                        <X size={15}/>
                                                    </button>
                                                </div>
                                            )) : (
                                                <div className="p-6 rounded-lg border border-dashed border-neutral-200 text-sm text-neutral-400 text-center">This date is open, but has no times yet.</div>
                                            )}
                                        </div>
                                        {isAddingSlot && (
                                            <div className="mb-5 p-4 rounded-lg border border-neutral-200 bg-white shadow-[0_18px_50px_-32px_rgba(0,0,0,0.45)] animate-in fade-in zoom-in-95 duration-300">
                                                <label className="text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-400 block mb-3">New Time Slot</label>
                                                <div className="flex items-center gap-3 mb-4">
                                                    <div className="h-12 flex-1 rounded-lg bg-neutral-50 border border-neutral-100 px-4 flex items-center gap-3 focus-within:bg-white focus-within:border-neutral-300 transition-all">
                                                        <Clock size={15} className="text-neutral-400"/>
                                                        <input
                                                            type="time"
                                                            value={newSlotTime}
                                                            onChange={(e) => setNewSlotTime(e.target.value)}
                                                            className="w-full bg-transparent outline-none text-lg font-bold tracking-widest text-black"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <button onClick={saveNewSlot} className="h-10 rounded-lg bg-[#39FF14] text-black text-[10px] font-bold uppercase tracking-widest hover:scale-[1.01] transition-transform">
                                                        Save Time
                                                    </button>
                                                    <button onClick={() => setIsAddingSlot(false)} className="h-10 rounded-lg border border-neutral-200 text-[10px] font-bold uppercase tracking-widest hover:bg-neutral-50 transition-colors">
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            <button
                                                onClick={startAddingSlot}
                                                disabled={!canEditSelectedCalendar}
                                                className={`h-11 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-colors shadow-xl shadow-black/10 ${canEditSelectedCalendar ? 'bg-black text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-300 cursor-not-allowed shadow-none'}`}
                                            >
                                                <Plus size={14}/> Add Slot
                                            </button>
                                            <button
                                                onClick={() => updateDateConfig(expandedDate, { available: true, times: [...defaultTimes] })}
                                                disabled={!canEditSelectedCalendar}
                                                className={`h-11 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors ${canEditSelectedCalendar ? 'border-neutral-200 hover:bg-neutral-50' : 'border-neutral-100 text-neutral-300 cursor-not-allowed'}`}
                                            >
                                                Use Defaults
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="p-6 rounded-lg bg-neutral-50 border border-neutral-100 text-center">
                                        <XCircle size={28} className="mx-auto mb-3 text-red-500"/>
                                        <p className="text-sm font-bold text-black mb-1">Closed for bookings</p>
                                        <p className="text-sm text-neutral-500 mb-5">Clients will not see this date as available.</p>
                                        <button onClick={() => updateDateConfig(expandedDate, { available: true, times: [...defaultTimes] })} disabled={!canEditSelectedCalendar} className={`h-11 px-5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${canEditSelectedCalendar ? 'bg-black text-white hover:bg-neutral-800' : 'bg-neutral-100 text-neutral-300 cursor-not-allowed'}`}>
                                            Reopen Day
                                        </button>
                                    </div>
                                )}
                            </section>
                        </aside>
                    </div>
                </div>
            );
        };
